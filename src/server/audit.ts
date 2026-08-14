import "server-only";
import { prisma } from "./db";

const sensitiveKeys = new Set(["password", "passwordHash", "confirmPassword", "token", "tokenHash"]);

function sanitize(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!sensitiveKeys.has(key)) {
        const sanitized = sanitize(entry);
        if (sanitized !== undefined) result[key] = sanitized;
      }
    }
    return result;
  }
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  return String(value);
}

function toAuditText(value: unknown) {
  const sanitized = sanitize(value);
  return sanitized === undefined ? undefined : JSON.stringify(sanitized);
}

export async function auditLog(input: {
  action: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      userId: input.userId,
      beforeData: toAuditText(input.beforeData),
      afterData: toAuditText(input.afterData),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}
