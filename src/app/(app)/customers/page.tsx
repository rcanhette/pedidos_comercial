import { CustomerForm, CustomerManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function CustomersPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("CLIENTE_VISUALIZAR");
  const customers = await listCatalog("customers", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      {user.permissions.includes("CLIENTE_CRIAR") ? <CustomerForm /> : null}
      <CustomerManager
        {...customers}
        canEdit={user.permissions.includes("CLIENTE_EDITAR")}
        canDelete={user.permissions.includes("CLIENTE_INATIVAR")}
      />
    </div>
  );
}
