import { ContractTypeForm, ContractTypeManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function ContractTypesPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("TIPO_CONTRATO_VISUALIZAR");
  const items = await listCatalog("contractTypes", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tipos de Contrato</h1>
      {user.permissions.includes("TIPO_CONTRATO_CRIAR") ? <ContractTypeForm /> : null}
      <ContractTypeManager {...items} canEdit={user.permissions.includes("TIPO_CONTRATO_EDITAR")} canDelete={user.permissions.includes("TIPO_CONTRATO_EXCLUIR")} />
    </div>
  );
}
