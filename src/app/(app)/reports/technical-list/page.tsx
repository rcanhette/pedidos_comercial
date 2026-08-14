import Link from "next/link";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { TechnicalListReport } from "@/features/reports/technical-list-report";
import { requirePermission } from "@/server/auth";
import { getTechnicalListReportOptions, listTechnicalListReportItems, parseTechnicalListReportQuery } from "@/server/technical-list-report-service";

export default async function TechnicalListReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("RELATORIO_VISUALIZAR");
  const params = await searchParams;
  const options = await getTechnicalListReportOptions(user);
  try {
    const query = parseTechnicalListReportQuery(params);
    const result = await listTechnicalListReportItems(user, query);
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Relatório da Lista Técnica</h1><p className="text-sm text-muted-foreground">Itens de matéria-prima vinculados aos pedidos.</p></div><Button asChild variant="outline"><Link href="/reports">Relatório de Vendas</Link></Button></div><TechnicalListReport {...result} rawMaterials={options.rawMaterials} /></div>;
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message ?? "Filtros inválidos." : error instanceof Error ? error.message : "Erro ao consultar Lista Técnica.";
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Relatório da Lista Técnica</h1><p className="text-sm text-muted-foreground">Itens de matéria-prima vinculados aos pedidos.</p></div><Button asChild variant="outline"><Link href="/reports">Relatório de Vendas</Link></Button></div><TechnicalListReport items={[]} total={0} page={1} pageSize={20} totalPages={1} filterSummary={["Todos os itens permitidos"]} rawMaterials={options.rawMaterials} error={message} /></div>;
  }
}
