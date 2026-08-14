import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { TechnicalListForm } from "@/features/orders/technical-list-form";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getOrderForUser } from "@/server/order-service";
import { formatCnpj, formatDateTimeBr, formatMoneyCents, formatQuantityScaled } from "@/lib/format";

export default async function TechnicalListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrderForUser(user, id);
  if (!order) notFound();
  const canEditTechnicalList = user.permissions.includes("MATERIA_PRIMA_VISUALIZAR") && !user.roles.includes("Representante Externo");
  if (!canEditTechnicalList || order.status === "CANCELADO") notFound();

  const rawMaterials = await prisma.rawMaterial.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Lista Técnica</p>
          <h1 className="text-2xl font-semibold">Pedido {order.number}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Nesta tela é possível alterar somente a Lista Técnica. Para modificar outros dados, utilize a opção Editar Pedido.</p>

      <section className="grid gap-4 rounded-lg border bg-background p-5 md:grid-cols-2 xl:grid-cols-4">
        <div><p className="text-sm text-muted-foreground">Cliente</p><p className="font-medium">{order.customerName}</p><p className="text-sm text-muted-foreground">{order.city} - {formatCnpj(order.cnpj)}</p></div>
        <div><p className="text-sm text-muted-foreground">Produto</p><p className="font-medium">{order.productNameSnapshot}</p><p className="text-sm text-muted-foreground">{formatQuantityScaled(order.quantityScaled)} TON - {order.packageNameSnapshot}</p></div>
        <div><p className="text-sm text-muted-foreground">Pedido SAP</p><p className="font-medium">{order.sapOrderNumber || "-"}</p><p className="text-sm text-muted-foreground">Solicitado em {formatDateTimeBr(order.solicitationAt)}</p></div>
        <div><p className="text-sm text-muted-foreground">Valor unitário</p><p className="font-medium">{formatMoneyCents(order.unitPriceCents, order.currencyCodeSnapshot)}</p><p className="text-sm text-muted-foreground">Status atual somente leitura</p></div>
      </section>

      <section className="rounded-lg border bg-background p-5">
        <TechnicalListForm order={order} rawMaterials={rawMaterials} canCreateRawMaterial={user.permissions.includes("MATERIA_PRIMA_CRIAR")} />
      </section>

      <div className="flex justify-start"><Button asChild variant="outline"><Link href={`/orders/${order.id}`}>Voltar ao pedido</Link></Button></div>
    </div>
  );
}
