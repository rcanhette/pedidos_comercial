import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { activeOrderStatusOptions, orderStatusLabels } from "@/lib/constants";
import { buildDashboardCountsWhere, buildOrdersListWhere, normalizeDashboardStatusCounts, ordersListPathForScope, ordersListScopeForUser, type OrdersListUserScope } from "@/lib/order-list";
import { ordersListQuerySchema } from "@/validations/order-list";

function parse(input: URLSearchParams) {
  return ordersListQuerySchema.parse(Object.fromEntries(input.entries()));
}

function user(overrides: Partial<OrdersListUserScope> = {}): OrdersListUserScope {
  return {
    id: "user_1",
    permissions: ["PEDIDO_VISUALIZAR_TODOS", "PEDIDO_VISUALIZAR_PROPRIOS"],
    ...overrides
  };
}

describe("listagem de pedidos filtrável", () => {
  it("aplica etapa e filtros combinados com AND", () => {
    const query = parse(new URLSearchParams({
      status: "PEDIDO_CRIADO",
      customerId: "cust_1",
      productId: "prod_1",
      contractTypeId: "contract_1",
      rawMaterialClosingId: "closing_1",
      representativeId: "rep_1",
      pedidoSap: " SAP-1 ",
      createdFrom: "2026-08-01",
      createdTo: "2026-08-31",
      pickupFrom: "2026-09",
      pickupTo: "2026-10"
    }));

    expect(buildOrdersListWhere(query, user(), "all")).toMatchObject({
      status: "PEDIDO_CRIADO",
      customerId: "cust_1",
      productId: "prod_1",
      contractTypeId: "contract_1",
      rawMaterialClosingId: "closing_1",
      createdById: "rep_1",
      sapOrderNumber: { contains: "SAP-1", mode: "insensitive" },
      solicitationAt: {
        gte: new Date("2026-08-01T00:00:00.000Z"),
        lt: new Date("2026-09-01T00:00:00.000Z")
      },
      pickupForecast: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lt: new Date("2026-11-01T00:00:00.000Z")
      }
    });
  });

  it("permite selecionar Todas limpando status e filtros vazios", () => {
    const query = parse(new URLSearchParams({ status: "", customerId: "", page: "3" }));
    expect(query.status).toBeUndefined();
    expect(query.customerId).toBeUndefined();
    expect(query.page).toBe(3);
    expect(buildOrdersListWhere(query, user(), "all")).toEqual({});
  });

  it("rejeita períodos inválidos e etapas inexistentes", () => {
    expect(() => parse(new URLSearchParams({ createdFrom: "2026-08-31", createdTo: "2026-08-01" }))).toThrow();
    expect(() => parse(new URLSearchParams({ pickupFrom: "2026-10", pickupTo: "2026-09" }))).toThrow();
    expect(() => parse(new URLSearchParams({ status: "RECUSADO" }))).toThrow();
  });

  it("restringe representante aos próprios pedidos e ignora representativeId em Meus pedidos", () => {
    const representative = user({ id: "rep_2", permissions: ["PEDIDO_VISUALIZAR_PROPRIOS"] });
    const query = parse(new URLSearchParams({ status: "RECEBIDO", representativeId: "rep_1" }));
    expect(buildOrdersListWhere(query, representative, "own")).toMatchObject({
      createdById: "rep_2",
      status: "RECEBIDO"
    });
    expect(() => buildOrdersListWhere(query, representative, "all")).toThrow();
  });

  it("usa o mesmo escopo da listagem para os contadores do Dashboard", () => {
    const admin = user({ id: "admin", permissions: ["PEDIDO_VISUALIZAR_TODOS", "PEDIDO_VISUALIZAR_PROPRIOS"] });
    const representative = user({ id: "rep_2", permissions: ["PEDIDO_VISUALIZAR_PROPRIOS"] });

    expect(ordersListScopeForUser(admin)).toBe("all");
    expect(ordersListPathForScope(ordersListScopeForUser(admin))).toBe("/orders/all");
    expect(buildDashboardCountsWhere(admin)).toEqual({});

    expect(ordersListScopeForUser(representative)).toBe("own");
    expect(ordersListPathForScope(ordersListScopeForUser(representative))).toBe("/orders/my");
    expect(buildDashboardCountsWhere(representative)).toEqual({ createdById: "rep_2" });
  });

  it("normaliza contadores do Dashboard mantendo etapas sem pedidos como zero", () => {
    const counts = normalizeDashboardStatusCounts([
      { status: "RECEBIDO", count: 15 },
      { status: "APROVADO", count: 8 },
      { status: "EM_CRIACAO", count: 6 },
      { status: "PEDIDO_CRIADO", count: 10 },
      { status: "ENVIADO_PARA_ASSINATURA", count: 4 }
    ]);

    expect(counts.RECEBIDO).toBe(15);
    expect(counts.APROVADO).toBe(8);
    expect(counts.EM_CRIACAO).toBe(6);
    expect(counts.PEDIDO_CRIADO).toBe(10);
    expect(counts.ENVIADO_PARA_ASSINATURA).toBe(4);
    expect(counts.CANCELADO).toBe(0);
  });

  it("bloqueia contadores do Dashboard para usuário sem permissão de pedidos", () => {
    expect(() => ordersListScopeForUser(user({ permissions: [] }))).toThrow("Você não possui permissão para visualizar pedidos.");
    expect(() => buildDashboardCountsWhere(user({ permissions: [] }))).toThrow("Você não possui permissão para visualizar pedidos.");
  });

  it("mantém os links do Dashboard para a lista filtrada por etapa", () => {
    const dashboard = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    expect(dashboard).toContain("activeOrderStatusOptions.map");
    expect(dashboard).toContain('href={`${ordersPath}?status=${status}`}');
    expect(dashboard).toContain("ordersListPathForScope(ordersListScopeForUser(user))");
    for (const status of activeOrderStatusOptions) {
      expect(orderStatusLabels[status]).toBeTruthy();
    }
    expect(dashboard).not.toContain("Últimos pedidos cadastrados");
    expect(dashboard).not.toContain("Pedidos aguardando análise");
    expect(dashboard).not.toContain("Novo pedido");
    expect(dashboard).not.toContain("Meus pedidos");
  });

  it("exibe filtro de etapa e preserva filtros na paginação", () => {
    const list = readFileSync("src/features/orders/orders-list.tsx", "utf8");
    expect(list).toContain("Etapa");
    expect(list).toContain('<option value="">Todas</option>');
    expect(list).toContain('params.set("page", String(nextPage))');
    expect(list).toContain("new URLSearchParams(searchParams.toString())");
    expect(list).toContain("Limpar filtros");
    expect(list).toContain("Voltar ao Dashboard");
  });

  it("disponibiliza todas as etapas aceitas no filtro de pedidos", () => {
    const list = readFileSync("src/features/orders/orders-list.tsx", "utf8");
    for (const status of activeOrderStatusOptions) {
      expect(list).toContain("activeOrderStatusOptions.map");
      expect(ordersListQuerySchema.parse({ status }).status).toBe(status);
    }
  });

  it("mantém filtros ao trocar de página e limpa filtros sem voltar ao Dashboard", () => {
    const list = readFileSync("src/features/orders/orders-list.tsx", "utf8");
    expect(list).toContain('params.set("page", String(nextPage))');
    expect(list).toContain("searchParams.toString()");
    expect(list).toContain("router.push(pathname)");
    expect(list).not.toContain('router.push("/dashboard")');
  });
});
