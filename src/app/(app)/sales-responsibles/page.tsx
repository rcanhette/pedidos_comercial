import { SalesResponsibleForm, SalesResponsibleManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function SalesResponsiblesPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("RESPONSAVEL_VENDA_VISUALIZAR");
  const items = await listCatalog("salesResponsibles", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Responsáveis pela Venda</h1>
      {user.permissions.includes("RESPONSAVEL_VENDA_CRIAR") ? <SalesResponsibleForm /> : null}
      <SalesResponsibleManager {...items} canEdit={user.permissions.includes("RESPONSAVEL_VENDA_EDITAR")} canDelete={user.permissions.includes("RESPONSAVEL_VENDA_EXCLUIR")} />
    </div>
  );
}
