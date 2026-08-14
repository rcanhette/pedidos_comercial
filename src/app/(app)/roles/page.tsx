import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";

export default async function RolesPage() {
  await requirePermission("PERMISSAO_CONFIGURAR");
  const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Perfis e permissões</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        {roles.map((role) => (
          <section key={role.id} className="rounded-lg border bg-background p-5">
            <h2 className="font-semibold">{role.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">{role.permissions.map((item) => <span key={item.permissionId} className="rounded-full bg-muted px-2 py-1 text-xs">{item.permission.code}</span>)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
