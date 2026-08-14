import "server-only";
import { promises as dns } from "dns";
import net from "net";
import tls from "tls";

type MailSocket = net.Socket | tls.TLSSocket;

type EmailValidationResult = {
  ok: boolean;
  email?: string;
  message?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readResponse(socket: MailSocket, timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao validar e-mail."));
    }, timeoutMs);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1);
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(socket: MailSocket, line: string, expected: number[], timeoutMs: number) {
  socket.write(`${line}\r\n`);
  const response = await readResponse(socket, timeoutMs);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) throw new Error(response.trim());
  return response;
}

function connect(host: string, port: number, timeoutMs: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(port, host);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Tempo esgotado ao conectar ao servidor de e-mail."));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function verifyRecipientBySmtp(email: string, mxHost: string) {
  const timeoutMs = Number(process.env.EMAIL_VALIDATION_SMTP_TIMEOUT_MS || 5000);
  const socket: MailSocket = await connect(mxHost, 25, timeoutMs);
  try {
    await readResponse(socket, timeoutMs);
    await command(socket, `HELO ${process.env.SMTP_HELO || "localhost"}`, [250], timeoutMs);
    await command(socket, `MAIL FROM:<${process.env.EMAIL_VALIDATION_FROM || "postmaster@localhost"}>`, [250], timeoutMs);
    await command(socket, `RCPT TO:<${email}>`, [250, 251, 252], timeoutMs);
    await command(socket, "QUIT", [221], timeoutMs).catch(() => undefined);
  } finally {
    socket.end();
  }
}

export async function validateDeliverableEmail(email: string): Promise<EmailValidationResult> {
  const normalizedEmail = normalizeEmail(email);
  const domain = normalizedEmail.split("@")[1];
  if (!domain) return { ok: false, message: "E-mail inválido." };

  let mxRecords: Array<{ exchange: string; priority: number }> = [];
  try {
    mxRecords = await dns.resolveMx(domain);
  } catch {
    return { ok: false, message: "O domínio do e-mail não possui servidor de recebimento válido." };
  }

  const activeMx = mxRecords
    .filter((record) => record.exchange && record.exchange !== ".")
    .sort((a, b) => a.priority - b.priority);

  if (!activeMx.length) {
    return { ok: false, message: "O domínio do e-mail não aceita recebimento de mensagens." };
  }

  if (process.env.EMAIL_VALIDATION_SMTP === "true") {
    try {
      await verifyRecipientBySmtp(normalizedEmail, activeMx[0].exchange);
    } catch {
      return { ok: false, message: "Não foi possível confirmar que este e-mail recebe mensagens." };
    }
  }

  return { ok: true, email: normalizedEmail };
}
