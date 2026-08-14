import { ZodError } from "zod";
import type { Order } from "@prisma/client";
import { OrdersList } from "@/features/orders/orders-list";
import { listOrders, orderListOptions, parseOrdersListQuery } from "@/server/order-service";
import { requirePermission } from "@/server/auth";
import { ordersListPageSize } from "@/validations/order-list";

type OrdersPageResult = { orders: Order[]; total: number; page: number; pageSize: number; totalPages: number };

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("PEDIDO_VISUALIZAR_PROPRIOS");
  const params = await searchParams;
  const options = await orderListOptions(user, "own");
  let result: OrdersPageResult = { orders: [], total: 0, page: 1, pageSize: ordersListPageSize, totalPages: 1 };
  let error: string | undefined;
  try {
    result = await listOrders(user, "own", parseOrdersListQuery(params));
  } catch (err) {
    error = err instanceof ZodError ? err.issues[0]?.message ?? "Filtros inválidos." : err instanceof Error ? err.message : "Erro ao consultar pedidos.";
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Meus pedidos</h1>
        <p className="text-sm text-muted-foreground">Pedidos cadastrados conforme seu escopo de visualização.</p>
      </div>
      <OrdersList {...result} currentUser={user} options={options} error={error} />
    </div>
  );
}
