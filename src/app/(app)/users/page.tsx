import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { UserForm, UserManager } from "@/features/admin/user-form";

export default async function UsersPage() {
  const currentUser = await requirePermission("USUARIO_VISUALIZAR");
  const [users, allRoles] = await Promise.all([
    prisma.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { fullName: "asc" } }),
    prisma.role.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);
  const roles = currentUser.permissions.includes("PERMISSAO_CONFIGURAR") ? allRoles : allRoles.filter((role) => role.name !== "Administrator");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      {currentUser.permissions.includes("USUARIO_CRIAR") ? <UserForm roles={roles} /> : null}
      <UserManager
        users={users}
        roles={roles}
        canEdit={currentUser.permissions.includes("USUARIO_EDITAR")}
        canDelete={currentUser.permissions.includes("USUARIO_INATIVAR")}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
