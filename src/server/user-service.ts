import "server-only";
import { prisma } from "./db";
import { assertPermission, hashPassword, type CurrentUser } from "./auth";
import { profileSchema, userCreateSchema, userUpdateSchema } from "@/validations/user";
import { validateDeliverableEmail } from "./email-validation";


async function roleIdsIncludeAdministrator(roleIds: string[]) {
  const count = await prisma.role.count({ where: { id: { in: roleIds }, name: "Administrator" } });
  return count > 0;
}

async function userHasAdministratorRole(userId: string) {
  const count = await prisma.userRole.count({ where: { userId, role: { name: "Administrator" } } });
  return count > 0;
}

function canManageAdministrator(user: CurrentUser) {
  return user.permissions.includes("PERMISSAO_CONFIGURAR");
}

async function assertCanAssignRoles(user: CurrentUser, roleIds: string[]) {
  assertPermission(user, "USUARIO_ATRIBUIR_PERFIL");
  if (!canManageAdministrator(user) && await roleIdsIncludeAdministrator(roleIds)) {
    throw new Error("Somente um usuário Administrator pode gerenciar outro Administrator.");
  }
}

async function assertCanManageTargetUser(user: CurrentUser, targetUserId: string) {
  if (!canManageAdministrator(user) && await userHasAdministratorRole(targetUserId)) {
    throw new Error("Somente um usuário Administrator pode gerenciar outro Administrator.");
  }
}

function formBoolean(formData: FormData, key: string) {
  return formData.getAll(key).includes("true");
}

function mustForcePasswordChange(username: string) {
  return username !== "admin";
}

function formObject(formData: FormData) {
  const values: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    if (value === "") continue;
    if (key === "roleIds") {
      const current = values.roleIds;
      values.roleIds = [...(Array.isArray(current) ? current : current ? [current] : []), value];
    } else {
      values[key] = value;
    }
  }
  return values;
}

export async function createUser(user: CurrentUser, formData: FormData) {
  assertPermission(user, "USUARIO_CRIAR");
  const parsed = userCreateSchema.parse({ ...formObject(formData), active: formBoolean(formData, "active") });
  await assertCanAssignRoles(user, parsed.roleIds);
  const emailValidation = await validateDeliverableEmail(parsed.email);
  if (!emailValidation.ok || !emailValidation.email) throw new Error(emailValidation.message || "E-mail inválido.");
  const validatedEmail = emailValidation.email;
  const passwordHash = await hashPassword(parsed.password);
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: parsed.fullName,
        username: parsed.username,
        email: validatedEmail,
        phone: parsed.phone,
        cpf: parsed.cpf,
        position: parsed.position,
        active: parsed.active,
        mustChangePassword: mustForcePasswordChange(parsed.username),
        passwordHash,
        roles: { create: parsed.roleIds.map((roleId) => ({ roleId })) }
      }
    });
    const createdRoles = await tx.role.findMany({ where: { id: { in: parsed.roleIds } }, select: { name: true } });
    await tx.auditLog.create({
      data: {
        action: "USER_CREATED",
        entity: "User",
        entityId: created.id,
        userId: user.id,
        afterData: JSON.stringify({ fullName: created.fullName, username: created.username, email: created.email, roles: createdRoles.map((role) => role.name) })
      }
    });
    return created;
  });
}

export async function updateUser(user: CurrentUser, userId: string, formData: FormData) {
  assertPermission(user, "USUARIO_EDITAR");
  const parsed = userUpdateSchema.parse({ ...formObject(formData), active: formBoolean(formData, "active") });
  await assertCanManageTargetUser(user, userId);
  await assertCanAssignRoles(user, parsed.roleIds);
  if (parsed.password) assertPermission(user, "USUARIO_REDEFINIR_SENHA");
  const emailValidation = await validateDeliverableEmail(parsed.email);
  if (!emailValidation.ok || !emailValidation.email) throw new Error(emailValidation.message || "E-mail inválido.");
  const validatedEmail = emailValidation.email;
  const passwordData = parsed.password
    ? { passwordHash: await hashPassword(parsed.password), mustChangePassword: mustForcePasswordChange(parsed.username) }
    : { mustChangePassword: mustForcePasswordChange(parsed.username) };
  return prisma.$transaction(async (tx) => {
    const previousRoles = await tx.userRole.findMany({ where: { userId }, include: { role: true } });
    const nextRoles = await tx.role.findMany({ where: { id: { in: parsed.roleIds } }, select: { name: true } });
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        fullName: parsed.fullName,
        username: parsed.username,
        email: validatedEmail,
        phone: parsed.phone,
        cpf: parsed.cpf,
        position: parsed.position,
        active: parsed.active,
        ...passwordData
      }
    });
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({ data: parsed.roleIds.map((roleId) => ({ userId, roleId })) });
    await tx.auditLog.create({
      data: {
        action: "USER_UPDATED",
        entity: "User",
        entityId: userId,
        userId: user.id,
        beforeData: JSON.stringify({ roles: previousRoles.map((item) => item.role.name) }),
        afterData: JSON.stringify({ fullName: updated.fullName, username: updated.username, email: updated.email, passwordReset: Boolean(parsed.password), roles: nextRoles.map((role) => role.name) })
      }
    });
    return updated;
  });
}

export async function updateOwnProfile(user: CurrentUser, formData: FormData) {
  const parsed = profileSchema.parse(formObject(formData));
  if (user.mustChangePassword && !parsed.password) throw new Error("Informe uma nova senha para continuar.");
  const emailValidation = await validateDeliverableEmail(parsed.email);
  if (!emailValidation.ok || !emailValidation.email) throw new Error(emailValidation.message || "E-mail inválido.");
  const validatedEmail = emailValidation.email;
  const passwordData = parsed.password ? { passwordHash: await hashPassword(parsed.password), mustChangePassword: false } : {};
  return prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: parsed.fullName,
      email: validatedEmail,
      phone: parsed.phone,
      cpf: parsed.cpf,
      position: parsed.position,
      ...passwordData
    }
  });
}


export async function deleteUser(user: CurrentUser, userId: string) {
  assertPermission(user, "USUARIO_INATIVAR");
  if (user.id === userId) throw new Error("Você não pode excluir o próprio usuário.");
  await assertCanManageTargetUser(user, userId);

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("Usuário não encontrado.");
    if (target.username === "admin") throw new Error("O usuário administrador interno não pode ser excluído.");

    const updated = await tx.user.update({
      where: { id: userId },
      data: { active: false }
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.loginChallenge.deleteMany({ where: { userId } });
    await tx.auditLog.create({
      data: {
        action: "USER_DELETED",
        entity: "User",
        entityId: userId,
        userId: user.id,
        afterData: JSON.stringify({ username: target.username, email: target.email, mode: "inactivated" })
      }
    });
    return updated;
  });
}
