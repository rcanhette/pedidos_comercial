import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth";
import { formatDateTimeBr } from "@/lib/format";

export default async function AuditPage() {
  await requirePermission("HISTORICO_VISUALIZAR");
  const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Auditoria</h1>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Data</th><th className="p-3">Ação</th><th className="p-3">Entidade</th><th className="p-3">Usuário</th><th className="p-3">IP</th></tr></thead>
          <tbody>{logs.map((log) => <tr key={log.id} className="border-t"><td className="p-3">{formatDateTimeBr(log.createdAt)}</td><td className="p-3">{log.action}</td><td className="p-3">{log.entity ?? "-"}</td><td className="p-3">{log.user?.fullName ?? "-"}</td><td className="p-3">{log.ipAddress ?? "-"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
