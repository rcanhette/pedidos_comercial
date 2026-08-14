import { describe, expect, it } from "vitest";
import { calculateCustomerShare, calculateSalesDashboard, getEffectiveMonthlyActual, optionalActualInputToScaled, orderQuantityToTonsScaled, salesDashboardRealizedStatuses, targetInputToScaled } from "@/lib/sales-dashboard";

describe("painel de vendas", () => {
  it("converte volume comercial para toneladas por unidade", () => {
    expect(orderQuantityToTonsScaled(125000, "t")).toBe(125000);
    expect(orderQuantityToTonsScaled(125000, "TONELADAS")).toBe(125000);
    expect(orderQuantityToTonsScaled(125000, "kg")).toBe(125);
    expect(orderQuantityToTonsScaled(125000, "un")).toBeNull();
  });

  it("usa somente status que representam venda realizada", () => {
    expect(salesDashboardRealizedStatuses).toEqual(["APROVADO", "EM_CRIACAO", "PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA"]);
    expect(salesDashboardRealizedStatuses).not.toContain("RECEBIDO");
    expect(salesDashboardRealizedStatuses).not.toContain("CANCELADO");
  });

  it("rejeita meta negativa", () => {
    expect(() => targetInputToScaled("-1")).toThrow("A meta não pode ser negativa.");
  });

  it("valida realizado manual opcional", () => {
    expect(optionalActualInputToScaled(undefined)).toBeNull();
    expect(optionalActualInputToScaled("")).toBeNull();
    expect(optionalActualInputToScaled("0")).toBe(0);
    expect(optionalActualInputToScaled("76.985,500")).toBe(76985500);
    expect(() => optionalActualInputToScaled("-1")).toThrow("O realizado manual não pode ser negativo.");
  });

  it("usa realizado manual como substituição sem somar pedidos", () => {
    expect(getEffectiveMonthlyActual(5000 * 1000, 76985 * 1000)).toBe(76985 * 1000);
    expect(getEffectiveMonthlyActual(5000 * 1000, 0)).toBe(0);
    expect(getEffectiveMonthlyActual(5000 * 1000, null)).toBe(5000 * 1000);
    const result = calculateSalesDashboard({
      year: 2026,
      targetsScaled: Array(12).fill(0),
      realizedScaled: [5000 * 1000, 5000 * 1000, 68000 * 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      manualActualScaled: [76985 * 1000, 0, null, undefined, null, null, null, null, null, null, null, null],
      currentDate: new Date("2026-03-15T00:00:00.000Z")
    });

    expect(result.months[0].realizedMonthlyScaled / 1000).toBe(76985);
    expect(result.months[0].realizedOrigin).toBe("manual");
    expect(result.months[1].realizedMonthlyScaled).toBe(0);
    expect(result.months[1].realizedOrigin).toBe("manual");
    expect(result.months[2].realizedMonthlyScaled / 1000).toBe(68000);
    expect(result.months[2].realizedOrigin).toBe("orders");
  });

  it("calcula acumulados, diferença, percentual e projeção anual", () => {
    const targetsScaled = [65000, 55000, 60000, 60000, 60000, 60000, 0, 0, 0, 0, 0, 0].map((value) => value * 1000);
    const realizedScaled = [76985, 101815, 69847, 43204, 42822, 74268, 0, 0, 0, 0, 0, 0].map((value) => value * 1000);
    const result = calculateSalesDashboard({
      year: 2026,
      targetsScaled,
      realizedScaled,
      currentDate: new Date("2026-06-16T12:00:00.000Z")
    });

    expect(result.months.slice(0, 6).map((item) => item.targetAccumulatedScaled / 1000)).toEqual([65000, 120000, 180000, 240000, 300000, 360000]);
    expect(result.months.slice(0, 6).map((item) => item.realizedAccumulatedScaled ? item.realizedAccumulatedScaled / 1000 : 0)).toEqual([76985, 178800, 248647, 291851, 334673, 408941]);
    expect(result.summary.targetAccumulatedScaled / 1000).toBe(360000);
    expect(result.summary.realizedAccumulatedScaled / 1000).toBe(408941);
    expect(result.summary.differenceScaled / 1000).toBe(48941);
    expect(result.summary.percentAchieved).toBeCloseTo(113.5947, 4);
    expect(result.summary.annualProjectionScaled).not.toBeNull();
    expect((result.summary.annualProjectionScaled ?? 0) / 1000).toBe(817882);
  });

  it("calcula acumulado com mistura de manual e pedidos", () => {
    const result = calculateSalesDashboard({
      year: 2026,
      targetsScaled: Array(12).fill(0),
      realizedScaled: [5, 6, 7, 50000, 55000, 0, 0, 0, 0, 0, 0, 0].map((value) => value * 1000),
      manualActualScaled: [70000, 80000, 60000, null, null, null, null, null, null, null, null, null].map((value) => value === null ? null : value * 1000),
      currentDate: new Date("2026-05-10T00:00:00.000Z")
    });

    expect(result.months.slice(0, 5).map((item) => item.realizedAccumulatedScaled ? item.realizedAccumulatedScaled / 1000 : 0)).toEqual([70000, 150000, 210000, 260000, 315000]);
    expect(result.summary.realizedAccumulatedScaled / 1000).toBe(315000);
  });

  it("interrompe realizado acumulado após último mês com vendas", () => {
    const result = calculateSalesDashboard({ year: 2026, targetsScaled: Array(12).fill(1000), realizedScaled: [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], currentDate: new Date("2026-06-01T00:00:00.000Z") });
    expect(result.months[0].realizedAccumulatedScaled).toBe(1000);
    expect(result.months[1].realizedAccumulatedScaled).toBeNull();
  });
});


describe("share por cliente", () => {
  it("agrupa pedidos do mesmo cliente e calcula percentuais com precisão", () => {
    const result = calculateCustomerShare([
      { customerId: "a", customerName: "Cliente A", tonsScaled: 30000 * 1000, orderId: "1" },
      { customerId: "a", customerName: "Cliente A", tonsScaled: 10000 * 1000, orderId: "2" },
      { customerId: "b", customerName: "Cliente B", tonsScaled: 20000 * 1000, orderId: "3" },
      { customerId: "c", customerName: "Cliente C", tonsScaled: 10000 * 1000, orderId: "4" }
    ]);
    expect(result.totalVolumeScaled / 1000).toBe(70000);
    expect(result.items.map((item) => item.name)).toEqual(["Cliente A", "Cliente B", "Cliente C"]);
    expect(result.items[0].sharePercent).toBeCloseTo(57.142857, 5);
    expect(result.items[1].sharePercent).toBeCloseTo(28.571429, 5);
    expect(result.items[2].sharePercent).toBeCloseTo(14.285714, 5);
    expect(result.topCustomer?.name).toBe("Cliente A");
    expect(result.totalOrders).toBe(4);
  });

  it("mantém os 7 maiores e agrupa demais em Outros", () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      customerId: `c${index + 1}`,
      customerName: `Cliente ${index + 1}`,
      tonsScaled: (10 - index) * 1000,
      orderId: `o${index + 1}`
    }));
    const result = calculateCustomerShare(rows);
    expect(result.displayItems).toHaveLength(8);
    expect(result.displayItems.slice(0, 7).map((item) => item.name)).toEqual(["Cliente 1", "Cliente 2", "Cliente 3", "Cliente 4", "Cliente 5", "Cliente 6", "Cliente 7"]);
    const others = result.displayItems[7];
    expect(others.name).toBe("Outros");
    expect(others.isOthers).toBe(true);
    expect(others.groupedCustomersCount).toBe(3);
    expect(others.volumeScaled).toBe((3 + 2 + 1) * 1000);
  });

  it("calcula concentração top 3 e classificação", () => {
    const result = calculateCustomerShare([
      { customerId: "a", customerName: "A", tonsScaled: 54000 * 1000, orderId: "1" },
      { customerId: "b", customerName: "B", tonsScaled: 9000 * 1000, orderId: "2" },
      { customerId: "c", customerName: "C", tonsScaled: 8000 * 1000, orderId: "3" },
      { customerId: "d", customerName: "D", tonsScaled: 29000 * 1000, orderId: "4" }
    ]);
    expect(result.top3ConcentrationPercent).toBeCloseTo(92, 1);
    expect(result.concentrationLabel).toBe("Alta concentração");
    expect(result.customersCount).toBe(4);
  });
});
