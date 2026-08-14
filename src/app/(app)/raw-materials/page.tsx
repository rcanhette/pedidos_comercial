import { RawMaterialForm, RawMaterialManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function RawMaterialsPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("MATERIA_PRIMA_VISUALIZAR");
  const items = await listCatalog("rawMaterials", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Matérias-Primas</h1>
      {user.permissions.includes("MATERIA_PRIMA_CRIAR") ? <RawMaterialForm /> : null}
      <RawMaterialManager {...items} canEdit={user.permissions.includes("MATERIA_PRIMA_EDITAR")} canDelete={user.permissions.includes("MATERIA_PRIMA_EXCLUIR")} />
    </div>
  );
}
