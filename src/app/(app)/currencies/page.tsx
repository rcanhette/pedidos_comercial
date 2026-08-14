import { CurrencyForm, CurrencyManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function CurrenciesPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("MOEDA_VISUALIZAR");
  const currencies = await listCatalog("currencies", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Moedas</h1>
      {user.permissions.includes("MOEDA_CRIAR") ? <CurrencyForm /> : null}
      <CurrencyManager
        {...currencies}
        canEdit={user.permissions.includes("MOEDA_EDITAR")}
        canDelete={user.permissions.includes("MOEDA_INATIVAR")}
      />
    </div>
  );
}
