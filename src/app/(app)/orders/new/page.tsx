import { OrderForm } from "@/features/orders/order-form";
import { requirePermission } from "@/server/auth";
import { catalogOptions } from "@/server/catalog-service";

export default async function NewOrderPage() {
  const user = await requirePermission("PEDIDO_CRIAR");
  const { customers, products, packages, currencies, contractTypes, rawMaterialClosings, rawMaterials, salesResponsibles, recentOptionIds } = await catalogOptions();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo pedido</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados comerciais para registrar a solicitação.</p>
      </div>
      <OrderForm customers={customers} products={products} packages={packages} currencies={currencies} contractTypes={contractTypes} rawMaterialClosings={rawMaterialClosings} salesResponsibles={salesResponsibles} rawMaterials={rawMaterials} recentOptionIds={recentOptionIds} canCreateRawMaterial={user.permissions.includes("MATERIA_PRIMA_CRIAR")} canEditTechnicalList={user.permissions.includes("MATERIA_PRIMA_VISUALIZAR") && !user.roles.includes("Representante Externo")} />
    </div>
  );
}
