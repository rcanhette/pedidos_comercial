import { PackageForm, PackageManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function PackagesPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("EMBALAGEM_VISUALIZAR");
  const packages = await listCatalog("packages", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Embalagens</h1>
      {user.permissions.includes("EMBALAGEM_CRIAR") ? <PackageForm /> : null}
      <PackageManager
        {...packages}
        canEdit={user.permissions.includes("EMBALAGEM_EDITAR")}
        canDelete={user.permissions.includes("EMBALAGEM_INATIVAR")}
      />
    </div>
  );
}
