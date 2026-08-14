import { RawMaterialClosingForm, RawMaterialClosingManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function RawMaterialClosingsPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("FECHAMENTO_MP_VISUALIZAR");
  const items = await listCatalog("rawMaterialClosings", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tipos de MP</h1>
      {user.permissions.includes("FECHAMENTO_MP_CRIAR") ? <RawMaterialClosingForm /> : null}
      <RawMaterialClosingManager {...items} canEdit={user.permissions.includes("FECHAMENTO_MP_EDITAR")} canDelete={user.permissions.includes("FECHAMENTO_MP_EXCLUIR")} />
    </div>
  );
}
