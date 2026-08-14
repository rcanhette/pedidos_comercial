import { ZodError } from "zod";
import { requirePermission } from "@/server/auth";
import { getCustomerSalesShare, getSalesDashboardOptions, getSalesPerformanceDashboard, getSalesTargetsForYear, parseCustomerShareFilters, parseSalesDashboardFilters } from "@/server/sales-dashboard-service";
import { SalesDashboardPanel } from "@/features/sales-dashboard/sales-dashboard-panel";

export default async function SalesDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("RELATORIO_VISUALIZAR");
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const params = await searchParams;
  const options = await getSalesDashboardOptions(user);
  try {
    const filters = parseSalesDashboardFilters(params);
    const shareFilters = parseCustomerShareFilters({ month: params.shareMonth, year: params.shareYear, productId: params.shareProductId, contractTypeId: params.shareContractTypeId, rawMaterialClosingId: params.shareRawMaterialClosingId, representativeId: params.shareRepresentativeId });
    const data = await getSalesPerformanceDashboard(user, filters);
    const [targets, customerShare] = await Promise.all([
      data.canManageTargets ? getSalesTargetsForYear(user, filters.year) : Promise.resolve([]),
      getCustomerSalesShare(user, shareFilters)
    ]);
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Painel de Vendas</h1>
          <p className="text-sm text-muted-foreground">Boca do Jacaré, share por cliente e metas mensais em toneladas.</p>
        </div>
        <SalesDashboardPanel data={data} customerShare={customerShare} options={options} targets={targets} currentYear={currentYear} currentMonth={currentDate.getMonth() + 1} />
      </div>
    );
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message ?? "Filtros inválidos." : error instanceof Error ? error.message : "Erro ao carregar painel.";
    return <div className="rounded-lg border bg-background p-6 text-sm text-red-700">{message}</div>;
  }
}
