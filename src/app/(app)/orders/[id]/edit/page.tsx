import { notFound } from "next/navigation";
import { OrderForm } from "@/features/orders/order-form";
import { requireUser } from "@/server/auth";
import { catalogOptions } from "@/server/catalog-service";
import { getOrderForUser } from "@/server/order-service";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrderForUser(user, id);
  if (!order) notFound();

  const canEdit = user.permissions.includes("PEDIDO_EDITAR_TODOS") ? order.status !== "CANCELADO" : user.permissions.includes("PEDIDO_EDITAR_PROPRIOS") && order.createdById === user.id && order.status === "RECEBIDO";
  if (!canEdit) notFound();

  const { customers, products, packages, currencies, contractTypes, rawMaterialClosings, rawMaterials, recentOptionIds } = await catalogOptions({ includeInactive: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar pedido {order.number}</h1>
        <p className="text-sm text-muted-foreground">Atualize os dados comerciais do pedido.</p>
      </div>
      <OrderForm customers={customers} products={products} packages={packages} currencies={currencies} contractTypes={contractTypes} rawMaterialClosings={rawMaterialClosings} rawMaterials={rawMaterials} recentOptionIds={recentOptionIds} order={order} canCreateRawMaterial={user.permissions.includes("MATERIA_PRIMA_CRIAR")} canEditTechnicalList={false} />
    </div>
  );
}
