import Link from "next/link";
import type { Order } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatCnpj, formatDateBr, formatMoneyCents, formatMonthYearBr, formatQuantityScaled } from "@/lib/format";

export function OrdersTable({
  orders,
  showRepresentative = false,
  currentUser,
  emptyMessage = "Nenhum pedido encontrado."
}: {
  orders: Order[];
  showRepresentative?: boolean;
  currentUser: { id: string; permissions: string[] };
  emptyMessage?: string;
}) {
  if (orders.length === 0) {
    return <div className="rounded-lg border bg-background p-8 text-center text-muted-foreground">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-3">ID</th>
            <th className="p-3">Pedido SAP</th>
            <th className="p-3">Solicitação</th>
            {showRepresentative ? <th className="p-3">Representante</th> : null}
            <th className="p-3">Cliente</th>
            <th className="p-3">CNPJ</th>
            <th className="p-3">Produto</th>
            <th className="p-3">Qtd.</th>
            <th className="p-3">Valor</th>
            <th className="p-3">Retirada</th>
            <th className="p-3">Status</th>
            <th className="p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const canEdit = currentUser.permissions.includes("PEDIDO_EDITAR_TODOS") ? order.status !== "CANCELADO" : currentUser.permissions.includes("PEDIDO_EDITAR_PROPRIOS") && order.createdById === currentUser.id && order.status === "RECEBIDO";
            return (
            <tr key={order.id} className="border-t">
              <td className="p-3 font-medium">{order.sequentialId}</td>
              <td className="p-3">{order.sapOrderNumber || "—"}</td>
              <td className="p-3">{formatDateBr(order.solicitationAt)}</td>
              {showRepresentative ? <td className="p-3">{order.representativeName}</td> : null}
              <td className="p-3">{order.customerName}</td>
              <td className="p-3">{formatCnpj(order.cnpj)}</td>
              <td className="p-3">{order.productNameSnapshot}</td>
              <td className="p-3">{formatQuantityScaled(order.quantityScaled)}</td>
              <td className="p-3">{formatMoneyCents(order.unitPriceCents, order.currencyCodeSnapshot)}</td>
              <td className="p-3">{formatMonthYearBr(order.pickupForecast)}</td>
              <td className="p-3"><StatusBadge status={order.status} /></td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="h-8 px-3"><Link href={`/orders/${order.id}`}>Visualizar</Link></Button>
                  {canEdit ? <Button asChild variant="outline" className="h-8 px-3"><Link href={`/orders/${order.id}/edit`}>Editar</Link></Button> : null}
                </div>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}
