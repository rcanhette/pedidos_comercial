import Link from "next/link";
import { ZodError } from "zod";
import { requirePermission } from "@/server/auth";
import { getSalesReportOptions, listSalesReportOrders, parseSalesReportQuery } from "@/server/sales-report-service";
import { SalesReport } from "@/features/reports/sales-report";
import { Button } from "@/components/ui/button";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("RELATORIO_VISUALIZAR");
  const params = await searchParams;
  const options = await getSalesReportOptions(user);

  try {
    const query = parseSalesReportQuery(params);
    const result = await listSalesReportOrders(user, query);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Relatório</h1>
            <p className="text-sm text-muted-foreground">Pedidos cadastrados com filtros, paginação e exportação.</p>
          </div>
          <Button asChild variant="outline"><Link href="/reports/technical-list">Relatório da Lista Técnica</Link></Button>
        </div>
        <SalesReport {...result} options={options} />
      </div>
    );
  } catch (error) {
    const message = error instanceof ZodError
      ? error.issues[0]?.message ?? "Filtros inválidos."
      : error instanceof Error
        ? error.message
        : "Erro ao consultar pedidos.";
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Relatório</h1>
            <p className="text-sm text-muted-foreground">Pedidos cadastrados com filtros, paginação e exportação.</p>
          </div>
          <Button asChild variant="outline"><Link href="/reports/technical-list">Relatório da Lista Técnica</Link></Button>
        </div>
        <SalesReport
          orders={[]}
          total={0}
          page={1}
          pageSize={20}
          totalPages={1}
          filterSummary={["Todos os pedidos permitidos"]}
          options={options}
          error={message}
        />
      </div>
    );
  }
}
