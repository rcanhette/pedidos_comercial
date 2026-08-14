import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { OrderPrintActions } from "@/features/orders/print-actions";
import { StatusForm } from "@/features/orders/status-form";
import { getOrderForUser } from "@/server/order-service";
import { requireUser } from "@/server/auth";
import { formatCnpj, formatDateBr, formatDateTimeBr, formatMoneyCents, formatMonthYearBr, formatQuantityScaled } from "@/lib/format";
import { formatRateScaled } from "@/lib/scalars";
import { formatQuantityScaledFixed } from "@/lib/scalars";

export default async function OrderDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrderForUser(user, id);
  if (!order) notFound();
  const canEdit = user.permissions.includes("PEDIDO_EDITAR_TODOS") ? order.status !== "CANCELADO" : user.permissions.includes("PEDIDO_EDITAR_PROPRIOS") && order.createdById === user.id && order.status === "RECEBIDO";
  const canEditTechnicalList = user.permissions.includes("MATERIA_PRIMA_VISUALIZAR") && !user.roles.includes("Representante Externo");
  const hasTechnicalList = order.technicalClosingItems.length > 0;
  const created = (await searchParams)?.created === "1";
  const freight = order.freightText?.trim() || formatMoneyCents(order.freightCents, order.currencyCodeSnapshot);
  const dollarRate = order.dollarRateText?.trim() || formatRateScaled(order.dollarRateScaled);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">ID do Pedido</p>
          <h1 className="text-2xl font-semibold">{order.sequentialId}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>
      {created ? <p className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-700">Pedido criado com sucesso.</p> : null}

      <div className="no-print flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href="/orders/my">Voltar</Link></Button>
        {canEdit ? <Button asChild variant="outline"><Link href={`/orders/${order.id}/edit`}>Editar Pedido</Link></Button> : null}
        {canEditTechnicalList ? <Button asChild variant={hasTechnicalList ? "outline" : "default"}><Link href={`/orders/${order.id}/technical-list`}>{hasTechnicalList ? "Editar Lista Técnica" : "Cadastrar Lista Técnica"}</Link></Button> : null}
        <OrderPrintActions />
      </div>

      {!hasTechnicalList && (canEditTechnicalList || !created) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{canEditTechnicalList ? "Lista Técnica pendente" : "Lista Técnica aguardando preenchimento pela equipe interna."}</p>
          {canEditTechnicalList ? <p className="mt-1">Este pedido foi recebido sem Lista Técnica. Cadastre a Lista Técnica antes de aprovar o pedido.</p> : null}
          {canEditTechnicalList ? <Button asChild className="mt-3"><Link href={`/orders/${order.id}/technical-list`}>Cadastrar Lista Técnica</Link></Button> : null}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg border bg-background p-5 md:grid-cols-2">
        <div><p className="text-sm text-muted-foreground">Representante</p><p className="font-medium">{order.representativeName}</p></div>
        <div><p className="text-sm text-muted-foreground">Pedido SAP</p><p>{order.sapOrderNumber || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Data da solicitação</p><p>{formatDateTimeBr(order.solicitationAt)}</p></div>
        <div><p className="text-sm text-muted-foreground">Tipo de Contrato</p><p>{order.contractTypeNameSnapshot || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Tipo de MP</p><p>{order.rawMaterialClosingNameSnapshot || "-"}</p></div>
        <div><p className="text-sm text-muted-foreground">Cliente</p><p>{order.customerName}</p></div>
        <div><p className="text-sm text-muted-foreground">Cidade / CNPJ</p><p>{order.city} - {formatCnpj(order.cnpj)}</p></div>
        <div><p className="text-sm text-muted-foreground">Produto</p><p>{order.productNameSnapshot}</p></div>
        <div><p className="text-sm text-muted-foreground">Quantidade / Embalagem</p><p>{formatQuantityScaled(order.quantityScaled)} TON - {order.packageNameSnapshot}</p></div>
        <div><p className="text-sm text-muted-foreground">Valor unitário</p><p>{formatMoneyCents(order.unitPriceCents, order.currencyCodeSnapshot)}</p></div>
        <div><p className="text-sm text-muted-foreground">Cotação do dólar</p><p>{dollarRate}</p></div>
        <div><p className="text-sm text-muted-foreground">Condição de pagamento</p><p>{order.paymentTerms}</p></div>
        <div><p className="text-sm text-muted-foreground">Comissão USD / Frete</p><p>{formatMoneyCents(order.commissionUsdCents, "USD")} / {freight}</p></div>
        <div><p className="text-sm text-muted-foreground">Data de pagamento</p><p>{formatDateBr(order.paymentDate)}</p></div>
        <div><p className="text-sm text-muted-foreground">Previsão de retirada</p><p>{formatMonthYearBr(order.pickupForecast)}</p></div>
        <div className="md:col-span-2"><p className="text-sm text-muted-foreground">Observações</p><p>{order.notes || "-"}</p></div>
      </section>

      <section className="rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-semibold">Lista Técnica</h2>
        {order.technicalClosingItems.length === 0 ? <p className="text-sm text-muted-foreground">{canEditTechnicalList ? "Pedido sem Lista Técnica registrada." : "Lista Técnica aguardando preenchimento pela equipe interna."}</p> : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-3">Matéria-prima</th><th className="p-3">Quantidade em KG</th><th className="p-3">Quantidade em TONS</th><th className="p-3">Preço</th></tr></thead>
              <tbody>
                {order.technicalClosingItems.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.rawMaterialNameSnapshot}</td><td className="p-3">{formatQuantityScaledFixed(item.quantityKgScaled)}</td><td className="p-3">{formatQuantityScaledFixed(item.quantityTonsScaled)}</td><td className="p-3">{formatMoneyCents(item.priceCents, order.currencyCodeSnapshot)}</td></tr>)}
                <tr className="border-t bg-muted/40 font-semibold"><td className="p-3">TOTAL</td><td className="p-3">{formatQuantityScaledFixed(order.technicalClosingItems.reduce((sum, item) => sum + item.quantityKgScaled, 0))}</td><td className="p-3">{formatQuantityScaledFixed(order.technicalClosingItems.reduce((sum, item) => sum + item.quantityTonsScaled, 0))}</td><td className="p-3">{formatMoneyCents(order.technicalClosingItems.reduce((sum, item) => sum + (item.priceCents ?? 0), 0), order.currencyCodeSnapshot)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {user.permissions.includes("PEDIDO_ALTERAR_STATUS") ? <StatusForm orderId={order.id} currentStatus={order.status} sapOrderNumber={order.sapOrderNumber} /> : null}

      <section className="rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-semibold">Histórico de status</h2>
        <div className="space-y-3">
          {order.statusHistory.map((item) => (
            <div key={item.id} className="rounded-md border p-3">
              <p className="font-medium">{item.previousStatus ? `${item.previousStatus} -> ` : ""}{item.newStatus}</p>
              <p className="text-sm text-muted-foreground">{formatDateTimeBr(item.changedAt)} por {item.changedBy.fullName}</p>
              {item.justification ? <p className="mt-1 text-sm">{item.justification}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
