import { ProductForm, ProductManager } from "@/features/admin/catalog-forms";
import { catalogQueryFromSearchParams, type CatalogPageSearchParams } from "@/lib/catalog-query";
import { requirePermission } from "@/server/auth";
import { listCatalog } from "@/server/catalog-service";

export default async function ProductsPage({ searchParams }: { searchParams: CatalogPageSearchParams }) {
  const user = await requirePermission("PRODUTO_VISUALIZAR");
  const products = await listCatalog("products", await catalogQueryFromSearchParams(searchParams));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Produtos</h1>
      {user.permissions.includes("PRODUTO_CRIAR") ? <ProductForm /> : null}
      <ProductManager
        {...products}
        canEdit={user.permissions.includes("PRODUTO_EDITAR")}
        canDelete={user.permissions.includes("PRODUTO_INATIVAR")}
      />
    </div>
  );
}
