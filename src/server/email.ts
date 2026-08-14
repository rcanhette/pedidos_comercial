import "server-only";
import net from "net";
import tls from "tls";

export type EmailInput = {
  to: string;
  subject: string;
  text: string;
};

type MailSocket = net.Socket | tls.TLSSocket;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração de e-mail ausente: ${name}.`);
  return value;
}

function smtpPort() {
  return Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? 465 : 587));
}

function readResponse(socket: MailSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
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
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(socket: MailSocket, line: string, expected: number[], label = line.split(" ")[0]) {
  socket.write(`${line}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) throw new Error(`SMTP falhou em ${label}: ${response.trim()}`);
  return response;
}

function connectPlain(host: string, port: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
    socket.once("error", reject);
  });
}

async function maybeStartTls(socket: MailSocket, host: string) {
  if (process.env.SMTP_SECURE === "true") return socket;
  if (process.env.SMTP_STARTTLS === "false") return socket;
  await command(socket, "STARTTLS", [220]);
  return tls.connect({ socket, servername: host });
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function emailAddress(value: string) {
  return value.match(/<([^>]+)>/)?.[1] || value;
}

function dotStuff(value: string) {
  return value.replace(/^\./gm, "..");
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendEmail(input: EmailInput) {
  const host = required("SMTP_HOST");
  const from = required("SMTP_FROM");
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  let socket: MailSocket = process.env.SMTP_SECURE === "true" ? await connectTls(host, smtpPort()) : await connectPlain(host, smtpPort());

  try {
    await readResponse(socket);
    await command(socket, `EHLO ${process.env.SMTP_HELO || "localhost"}`, [250]);
    socket = await maybeStartTls(socket, host);
    if (!(process.env.SMTP_SECURE === "true") && process.env.SMTP_STARTTLS !== "false") {
      await command(socket, `EHLO ${process.env.SMTP_HELO || "localhost"}`, [250]);
    }

    if (username && password) {
      await command(socket, "AUTH LOGIN", [334]);
      await command(socket, Buffer.from(username).toString("base64"), [334], "AUTH_USERNAME");
      await command(socket, Buffer.from(password).toString("base64"), [235], "AUTH_PASSWORD");
    }

    await command(socket, `MAIL FROM:<${emailAddress(from)}>`, [250]);
    await command(socket, `RCPT TO:<${input.to}>`, [250, 251]);
    await command(socket, "DATA", [354]);

    const body = [
      `From: ${from}`,
      `To: ${input.to}`,
      `Subject: ${encodeHeader(input.subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      dotStuff(input.text),
      "."
    ].join("\r\n");
    await command(socket, body, [250]);
    await command(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}
