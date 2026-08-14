import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import { auditLog } from "./audit";
import { sendEmail } from "./email";
import { appName } from "@/lib/app-config";
import type { PermissionCode } from "@/lib/permissions";

const sessionCookie = "pedidos_session";
const loginChallengeCookie = "pedidos_login_challenge";
const sessionDays = 7;
const loginChallengeMinutes = 10;
const maxLoginChallengeAttempts = 5;

function shouldUseSecureSessionCookie() {
  return process.env.SESSION_COOKIE_SECURE === "true";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashLoginCode(token: string, code: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "development-session-secret")
    .update(`${token}:${code}`)
    .digest("hex");
}

function generateLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

function canBypassEmailTwoFactor(user: { username: string }) {
  return user.username === "admin";
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent") || undefined
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  const meta = await getRequestMeta();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    }
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    expires: expiresAt,
    maxAge: sessionDays * 24 * 60 * 60,
    path: "/"
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(sessionCookie);
  cookieStore.delete(loginChallengeCookie);
}


async function startLoginChallenge(user: { id: string; email: string; fullName: string }, provider: "password" | "google" | "microsoft") {
  const token = randomBytes(32).toString("base64url");
  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + loginChallengeMinutes * 60 * 1000);
  const meta = await getRequestMeta();

  await prisma.loginChallenge.deleteMany({
    where: {
      userId: user.id,
      consumedAt: null
    }
  });

  await prisma.loginChallenge.create({
    data: {
      tokenHash: hashToken(token),
      codeHash: hashLoginCode(token, code),
      userId: user.id,
      email: user.email,
      provider,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(loginChallengeCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    expires: expiresAt,
    maxAge: loginChallengeMinutes * 60,
    path: "/"
  });

  try {
    await sendEmail({
      to: user.email,
      subject: `Código de acesso - ${appName}`,
      text: [
        `Olá, ${user.fullName}.`,
        "",
        `Seu código de acesso ao ${appName} é: ${code}`,
        "",
        `Ele expira em ${loginChallengeMinutes} minutos.`,
        "Se você não tentou entrar no sistema, ignore este e-mail e avise o administrador."
      ].join("\n")
    });
  } catch (error) {
    await prisma.loginChallenge.deleteMany({ where: { tokenHash: hashToken(token) } });
    cookieStore.delete(loginChallengeCookie);
    await auditLog({ action: "LOGIN_2FA_SEND_FAILED", entity: "User", entityId: user.id, userId: user.id, afterData: { provider, error: error instanceof Error ? error.message : String(error) }, ...meta });
    return { ok: false as const, message: "Não foi possível enviar o código por e-mail. Verifique a configuração SMTP." };
  }

  await auditLog({ action: "LOGIN_2FA_SENT", entity: "User", entityId: user.id, userId: user.id, afterData: { provider, email: maskEmail(user.email) }, ...meta });
  return { ok: true as const, email: maskEmail(user.email) };
}

export async function getPendingLoginChallenge() {
  const cookieStore = await cookies();
  const token = cookieStore.get(loginChallengeCookie)?.value;
  if (!token) return null;

  const challenge = await prisma.loginChallenge.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { email: true, expiresAt: true, consumedAt: true }
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) return null;
  return { email: maskEmail(challenge.email), expiresAt: challenge.expiresAt };
}

export async function verifyLoginChallenge(code: string) {
  const meta = await getRequestMeta();
  const normalizedCode = code.replace(/\D/g, "");
  const cookieStore = await cookies();
  const token = cookieStore.get(loginChallengeCookie)?.value;

  if (!token || normalizedCode.length !== 6) {
    return { ok: false as const, message: "Código inválido." };
  }

  const challenge = await prisma.loginChallenge.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
    cookieStore.delete(loginChallengeCookie);
    return { ok: false as const, message: "Código expirado. Faça login novamente." };
  }

  if (challenge.attempts >= maxLoginChallengeAttempts) {
    cookieStore.delete(loginChallengeCookie);
    await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    await auditLog({ action: "LOGIN_2FA_LOCKED", entity: "User", entityId: challenge.userId, userId: challenge.userId, ...meta });
    return { ok: false as const, message: "Muitas tentativas incorretas. Faça login novamente." };
  }

  const expectedHash = hashLoginCode(token, normalizedCode);
  if (!secureCompare(expectedHash, challenge.codeHash)) {
    await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    await auditLog({ action: "LOGIN_2FA_FAILED", entity: "User", entityId: challenge.userId, userId: challenge.userId, afterData: { attempts: challenge.attempts + 1 }, ...meta });
    return { ok: false as const, message: "Código inválido." };
  }

  if (!challenge.user.active) {
    cookieStore.delete(loginChallengeCookie);
    await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    return { ok: false as const, message: "Usuário inativo. Procure o administrador." };
  }

  await prisma.loginChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  cookieStore.delete(loginChallengeCookie);
  await prisma.user.update({ where: { id: challenge.userId }, data: { lastAccessAt: new Date() } });
  await createSession(challenge.userId);
  await auditLog({ action: "LOGIN", entity: "User", entityId: challenge.userId, userId: challenge.userId, afterData: { provider: challenge.provider, twoFactor: "email" }, ...meta });
  return { ok: true as const };
}

export async function login(identifier: string, password: string) {
  const meta = await getRequestMeta();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier.toLowerCase() }]
    }
  });
  const invalid = "Usuário ou senha inválidos.";

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await auditLog({ action: "LOGIN_FAILED", entity: "User", userId: user?.id, afterData: { identifier }, ...meta });
    return { ok: false as const, message: invalid };
  }
  if (!user.active) {
    await auditLog({ action: "LOGIN_FAILED", entity: "User", userId: user.id, afterData: { reason: "inactive" }, ...meta });
    return { ok: false as const, message: "Usuário inativo. Procure o administrador." };
  }

  if (canBypassEmailTwoFactor(user)) {
    await prisma.user.update({ where: { id: user.id }, data: { lastAccessAt: new Date(), mustChangePassword: false } });
    await createSession(user.id);
    await auditLog({ action: "LOGIN", entity: "User", entityId: user.id, userId: user.id, afterData: { provider: "password", twoFactor: "bypassed_admin_local" }, ...meta });
    return { ok: true as const, bypassedTwoFactor: true as const };
  }

  return startLoginChallenge(user, "password");
}

export async function loginWithVerifiedEmail(provider: "google" | "microsoft", email: string) {
  const meta = await getRequestMeta();
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    await auditLog({ action: "OAUTH_LOGIN_FAILED", entity: "User", afterData: { provider, email: normalizedEmail, reason: "unknown_email" }, ...meta });
    return { ok: false as const, message: "E-mail não autorizado. Solicite acesso ao administrador." };
  }

  if (!user.active) {
    await auditLog({ action: "OAUTH_LOGIN_FAILED", entity: "User", userId: user.id, afterData: { provider, reason: "inactive" }, ...meta });
    return { ok: false as const, message: "Usuário inativo. Procure o administrador." };
  }

  await auditLog({ action: "OAUTH_LOGIN_VERIFIED", entity: "User", entityId: user.id, userId: user.id, afterData: { provider }, ...meta });
  return startLoginChallenge(user, provider);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          permissions: { include: { permission: true } }
        }
      }
    }
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  const rolePermissions = session.user.roles.flatMap((item) =>
    item.role.permissions.map((permission) => permission.permission.code)
  );
  const denied = new Set(
    session.user.permissions.filter((item) => item.effect === "DENY").map((item) => item.permission.code)
  );
  const allowed = new Set([
    ...rolePermissions,
    ...session.user.permissions.filter((item) => item.effect === "ALLOW").map((item) => item.permission.code)
  ]);
  denied.forEach((permission) => allowed.delete(permission));

  return {
    id: session.user.id,
    fullName: session.user.fullName,
    username: session.user.username,
    email: session.user.email,
    phone: session.user.phone,
    cpf: session.user.cpf,
    position: session.user.position,
    mustChangePassword: session.user.mustChangePassword,
    roles: session.user.roles.map((item) => item.role.name),
    permissions: [...allowed]
  };
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: PermissionCode) {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) redirect("/dashboard");
  return user;
}

export function assertPermission(user: CurrentUser, permission: PermissionCode) {
  if (!user.permissions.includes(permission)) {
    throw new Error("Você não possui permissão para executar esta ação.");
  }
}

export function secureCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
