import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardData } from "@/server/order-service";
import { requireUser } from "@/server/auth";
import { activeOrderStatusOptions, orderStatusLabels } from "@/lib/constants";
import { ordersListPathForScope, ordersListScopeForUser } from "@/lib/order-list";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await dashboardData(user);
  const ordersPath = ordersListPathForScope(ordersListScopeForUser(user));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Indicadores calculados conforme suas permissões.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {activeOrderStatusOptions.map((status) => (
          <Link key={status} href={`${ordersPath}?status=${status}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent>
                <p className="text-sm text-muted-foreground">{orderStatusLabels[status]}</p>
                <p className="mt-2 text-3xl font-semibold">{data.counts[status]}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.counts[status] === 1 ? "pedido" : "pedidos"}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
