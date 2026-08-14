import { orderStatusLabels } from "./constants";
import { quantityInputToScaled } from "./scalars";

export const salesDashboardRealizedStatuses = ["APROVADO", "EM_CRIACAO", "PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA"] as const;
export const monthLabels = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"] as const;
export const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] as const;

export type SalesDashboardMonth = {
  month: number;
  label: string;
  name: string;
  targetMonthlyScaled: number;
  calculatedRealizedMonthlyScaled: number;
  manualActualMonthlyScaled: number | null;
  realizedMonthlyScaled: number;
  realizedOrigin: "manual" | "orders";
  targetAccumulatedScaled: number;
  realizedAccumulatedScaled: number | null;
  monthlyDifferenceScaled: number;
  accumulatedDifferenceScaled: number | null;
  monthlyPercent: number | null;
  accumulatedPercent: number | null;
  hasTarget: boolean;
  hasSales: boolean;
  isCurrentMonth: boolean;
};

export type SalesDashboardSummary = {
  targetAccumulatedScaled: number;
  realizedAccumulatedScaled: number;
  percentAchieved: number | null;
  differenceScaled: number;
  annualTargetScaled: number;
  annualProjectionScaled: number | null;
  monthsAboveTarget: number;
  monthsBelowTarget: number;
  hasAnyTarget: boolean;
  hasAnySales: boolean;
  ignoredIncompatibleOrders: number;
};

export function normalizeUnit(unit: string | null | undefined) {
  return (unit ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function orderQuantityToTonsScaled(quantityScaled: number, unit: string | null | undefined) {
  const normalized = normalizeUnit(unit);
  if (["t", "ton", "tons", "tonelada", "toneladas"].includes(normalized)) return quantityScaled;
  if (["kg", "kgs", "quilo", "quilos", "kilograma", "kilogramas", "quilograma", "quilogramas"].includes(normalized)) return Math.round(quantityScaled / 1000);
  return null;
}

export function targetInputToScaled(value: string | undefined) {
  if (!value) return 0;
  const scaled = quantityInputToScaled(value);
  if (scaled === undefined) return 0;
  if (scaled < 0) throw new Error("A meta não pode ser negativa.");
  return scaled;
}

export function optionalActualInputToScaled(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const scaled = quantityInputToScaled(value);
  if (scaled === undefined) return null;
  if (scaled < 0) throw new Error("O realizado manual não pode ser negativo.");
  return scaled;
}

export function getEffectiveMonthlyActual(calculatedScaled: number, manualScaled: number | null | undefined) {
  return manualScaled ?? calculatedScaled;
}

export function percent(realizedScaled: number, targetScaled: number) {
  if (targetScaled <= 0) return null;
  return (realizedScaled / targetScaled) * 100;
}

export function calculateSalesDashboard(params: {
  year: number;
  targetsScaled: number[];
  realizedScaled: number[];
  manualActualScaled?: Array<number | null | undefined>;
  currentDate?: Date;
  ignoredIncompatibleOrders?: number;
}) {
  const currentDate = params.currentDate ?? new Date();
  const selectedYear = params.year;
  const currentYear = currentDate.getFullYear();
  const currentMonth = selectedYear === currentYear ? currentDate.getMonth() + 1 : selectedYear < currentYear ? 12 : 0;
  const effectiveRealizedScaled = params.realizedScaled.map((value, index) => getEffectiveMonthlyActual(value, params.manualActualScaled?.[index]));
  const lastSalesMonth = effectiveRealizedScaled.reduce((last, value, index) => value > 0 ? index + 1 : last, 0);
  const realizedLineUntil = lastSalesMonth;
  let targetAccum = 0;
  let realizedAccum = 0;
  let monthsAboveTarget = 0;
  let monthsBelowTarget = 0;

  const months: SalesDashboardMonth[] = monthLabels.map((label, index) => {
    const month = index + 1;
    const targetMonthly = params.targetsScaled[index] ?? 0;
    const calculatedRealizedMonthly = params.realizedScaled[index] ?? 0;
    const manualActualMonthly = params.manualActualScaled?.[index] ?? null;
    const realizedMonthly = getEffectiveMonthlyActual(calculatedRealizedMonthly, manualActualMonthly);
    targetAccum += targetMonthly;
    realizedAccum += realizedMonthly;
    const realizedAccumulated = month <= realizedLineUntil ? realizedAccum : null;
    const monthlyPercent = percent(realizedMonthly, targetMonthly);
    const accumulatedPercent = realizedAccumulated === null ? null : percent(realizedAccumulated, targetAccum);
    if (targetMonthly > 0 && realizedMonthly >= targetMonthly) monthsAboveTarget += 1;
    if (targetMonthly > 0 && realizedMonthly < targetMonthly) monthsBelowTarget += 1;
    return {
      month,
      label,
      name: monthNames[index],
      targetMonthlyScaled: targetMonthly,
      calculatedRealizedMonthlyScaled: calculatedRealizedMonthly,
      manualActualMonthlyScaled: manualActualMonthly,
      realizedMonthlyScaled: realizedMonthly,
      realizedOrigin: manualActualMonthly === null || manualActualMonthly === undefined ? "orders" : "manual",
      targetAccumulatedScaled: targetAccum,
      realizedAccumulatedScaled: realizedAccumulated,
      monthlyDifferenceScaled: realizedMonthly - targetMonthly,
      accumulatedDifferenceScaled: realizedAccumulated === null ? null : realizedAccumulated - targetAccum,
      monthlyPercent,
      accumulatedPercent,
      hasTarget: targetMonthly > 0,
      hasSales: realizedMonthly > 0,
      isCurrentMonth: month === currentMonth
    };
  });

  const cardMonth = Math.max(0, Math.min(12, currentMonth));
  const targetAccumulatedScaled = months.slice(0, cardMonth).reduce((sum, item) => sum + item.targetMonthlyScaled, 0);
  const realizedAccumulatedScaled = months.slice(0, cardMonth).reduce((sum, item) => sum + item.realizedMonthlyScaled, 0);
  const monthsConsidered = Math.max(1, Math.min(cardMonth || lastSalesMonth || 1, lastSalesMonth || cardMonth || 1));
  const annualProjectionScaled = realizedAccumulatedScaled > 0 ? Math.round((realizedAccumulatedScaled / monthsConsidered) * 12) : null;
  const annualTargetScaled = params.targetsScaled.reduce((sum, value) => sum + value, 0);

  return {
    months,
    summary: {
      targetAccumulatedScaled,
      realizedAccumulatedScaled,
      percentAchieved: percent(realizedAccumulatedScaled, targetAccumulatedScaled),
      differenceScaled: realizedAccumulatedScaled - targetAccumulatedScaled,
      annualTargetScaled,
      annualProjectionScaled,
      monthsAboveTarget,
      monthsBelowTarget,
      hasAnyTarget: annualTargetScaled > 0,
      hasAnySales: effectiveRealizedScaled.some((value) => value > 0),
      ignoredIncompatibleOrders: params.ignoredIncompatibleOrders ?? 0
    } satisfies SalesDashboardSummary
  };
}

export function statusLabel(status: string) {
  return orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status;
}

export type CustomerShareSource = {
  customerId: string | null;
  customerName: string;
  tonsScaled: number;
  orderId: string;
};

export type CustomerShareItem = {
  id: string;
  name: string;
  volumeScaled: number;
  sharePercent: number;
  ordersCount: number;
  ranking: number;
  isOthers: boolean;
  groupedCustomers?: string[];
  groupedCustomersCount?: number;
};

export function concentrationClass(value: number) {
  if (value > 60) return "Alta concentração";
  if (value > 40) return "Concentração moderada";
  return "Baixa concentração";
}

export function calculateCustomerShare(rows: CustomerShareSource[]) {
  const grouped = new Map<string, { id: string; name: string; volumeScaled: number; orderIds: Set<string> }>();
  for (const row of rows) {
    const id = row.customerId ?? row.customerName;
    const current = grouped.get(id) ?? { id, name: row.customerName || "Não informado", volumeScaled: 0, orderIds: new Set<string>() };
    current.volumeScaled += row.tonsScaled;
    current.orderIds.add(row.orderId);
    grouped.set(id, current);
  }

  const ranked = [...grouped.values()]
    .sort((a, b) => b.volumeScaled - a.volumeScaled || a.name.localeCompare(b.name))
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      volumeScaled: item.volumeScaled,
      sharePercent: 0,
      ordersCount: item.orderIds.size,
      ranking: index + 1,
      isOthers: false
    } satisfies CustomerShareItem));

  const totalVolumeScaled = ranked.reduce((sum, item) => sum + item.volumeScaled, 0);
  const totalOrders = new Set(rows.map((row) => row.orderId)).size;
  const withShare = ranked.map((item) => ({ ...item, sharePercent: totalVolumeScaled > 0 ? (item.volumeScaled / totalVolumeScaled) * 100 : 0 }));
  const top = withShare.slice(0, 7);
  const rest = withShare.slice(7);
  const displayItems: CustomerShareItem[] = rest.length === 0 ? top : [
    ...top,
    {
      id: "__others__",
      name: "Outros",
      volumeScaled: rest.reduce((sum, item) => sum + item.volumeScaled, 0),
      sharePercent: rest.reduce((sum, item) => sum + item.sharePercent, 0),
      ordersCount: rest.reduce((sum, item) => sum + item.ordersCount, 0),
      ranking: 8,
      isOthers: true,
      groupedCustomers: rest.map((item) => item.name),
      groupedCustomersCount: rest.length
    } satisfies CustomerShareItem
  ];
  const top3ConcentrationPercent = withShare.slice(0, 3).reduce((sum, item) => sum + item.sharePercent, 0);
  const topCustomer = withShare[0] ?? null;
  return {
    items: withShare,
    displayItems,
    totalVolumeScaled,
    totalOrders,
    customersCount: withShare.length,
    topCustomer,
    top3ConcentrationPercent,
    concentrationLabel: concentrationClass(top3ConcentrationPercent)
  };
}
