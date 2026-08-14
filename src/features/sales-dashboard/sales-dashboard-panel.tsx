"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Maximize2, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { monthLabels, monthNames, salesDashboardRealizedStatuses, statusLabel, type CustomerShareItem, type SalesDashboardMonth, type SalesDashboardSummary } from "@/lib/sales-dashboard";
import { quantityScaledToDecimal } from "@/lib/scalars";
import { saveSalesTargetsAction, type SalesTargetActionState } from "@/app/(app)/dashboard/sales/actions";

type Option = { id: string; name: string; active: boolean; city?: string };
type TargetRow = { month: number; targetTonsScaled: number; manualActualTonsScaled: number | null };
type ShareData = {
  filters: { month: number; year: number; productId?: string; contractTypeId?: string; rawMaterialClosingId?: string; representativeId?: string };
  filterSummary: string[];
  displayItems: CustomerShareItem[];
  items: CustomerShareItem[];
  totalVolumeScaled: number;
  totalOrders: number;
  customersCount: number;
  topCustomer: CustomerShareItem | null;
  top3ConcentrationPercent: number;
  concentrationLabel: string;
  ignoredIncompatibleOrders: number;
};

const initialState: SalesTargetActionState = { ok: false };
const palette = ["#0f6b99", "#d97706", "#2f855a", "#7c3aed", "#b91c1c", "#0f766e", "#4338ca", "#71717a"];

function formatTons(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const decimal = value / 1000;
  const hasFraction = Math.abs(value % 1000) > 0;
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: hasFraction ? 3 : 0, maximumFractionDigits: 3 }).format(decimal);
}

function formatSignedTons(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatTons(Math.abs(value))} tons`;
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "Meta não cadastrada";
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}%`;
}

function inputValue(value: number) {
  const decimal = quantityScaledToDecimal(value) ?? 0;
  return decimal === 0 ? "" : String(decimal).replace(".", ",");
}

function optionalInputValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(quantityScaledToDecimal(value) ?? 0).replace(".", ",");
}

export function SalesDashboardPanel({
  data,
  customerShare,
  options,
  targets,
  currentYear,
  currentMonth
}: {
  data: {
    filters: { year: number; customerId?: string; productId?: string; contractTypeId?: string; rawMaterialClosingId?: string; representativeId?: string };
    filterSummary: string[];
    canManageTargets: boolean;
    usesManualActuals: boolean;
    months: SalesDashboardMonth[];
    summary: SalesDashboardSummary;
  };
  customerShare: ShareData;
  options: { customers: Option[]; products: Option[]; contractTypes: Option[]; rawMaterialClosings: Option[]; representatives: Array<{ id: string; fullName: string; active: boolean }> };
  targets: TargetRow[];
  currentYear: number;
  currentMonth: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [state, action, targetPending] = useActionState(saveSalesTargetsAction, initialState);
  const [autoRefresh, setAutoRefresh] = useState("off");

  useEffect(() => {
    if (autoRefresh === "off") return;
    const minutes = Number(autoRefresh);
    const interval = window.setInterval(() => router.refresh(), minutes * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, router]);

  const chartData = useMemo(() => data.months.map((item) => ({
    ...item,
    targetMonthly: item.targetMonthlyScaled / 1000,
    realizedMonthly: item.realizedMonthlyScaled / 1000,
    targetAccumulated: item.targetAccumulatedScaled / 1000,
    realizedAccumulated: item.realizedAccumulatedScaled === null ? null : item.realizedAccumulatedScaled / 1000
  })), [data.months]);

  const treemapData = useMemo(() => customerShare.displayItems.map((item, index) => ({
    ...item,
    size: item.volumeScaled,
    fill: item.isOthers ? "#71717a" : palette[index % palette.length]
  })), [customerShare.displayItems]);

  function param(name: string) {
    return searchParams.get(name) ?? "";
  }

  function applyExecutiveFilters(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["year", "customerId", "productId", "contractTypeId", "rawMaterialClosingId", "representativeId"]) params.delete(key);
    for (const [key, value] of formData.entries()) if (typeof value === "string" && value.trim()) params.set(key, value);
    startTransition(() => router.push(`/dashboard/sales?${params.toString()}`));
  }

  function applyShareFilters(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["shareMonth", "shareYear", "shareProductId", "shareContractTypeId", "shareRawMaterialClosingId", "shareRepresentativeId"]) params.delete(key);
    for (const [key, value] of formData.entries()) if (typeof value === "string" && value.trim()) params.set(key, value);
    startTransition(() => router.push(`/dashboard/sales?${params.toString()}`));
  }

  function shareMonthHref(delta: number) {
    const date = new Date(Date.UTC(customerShare.filters.year, customerShare.filters.month - 1 + delta, 1));
    const params = new URLSearchParams(searchParams.toString());
    params.set("shareMonth", String(date.getUTCMonth() + 1));
    params.set("shareYear", String(date.getUTCFullYear()));
    return `/dashboard/sales?${params.toString()}`;
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  return (
    <Tabs defaultValue="executive" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="executive">Visão Executiva</TabsTrigger>
          <TabsTrigger value="share">Share por Cliente</TabsTrigger>
          {data.canManageTargets ? <TabsTrigger value="targets">Configuração de Metas</TabsTrigger> : null}
        </TabsList>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.refresh()}><RefreshCw size={18} />Atualizar dados</Button>
          <Button type="button" variant="outline" onClick={toggleFullscreen}><Maximize2 size={18} />Tela cheia</Button>
          <label className="text-sm font-medium">Atualização automática<select value={autoRefresh} onChange={(event) => setAutoRefresh(event.target.value)} className="ml-2 h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="off">Desativada</option><option value="5">5 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option></select></label>
        </div>
      </div>

      <TabsContent value="executive" className="space-y-5">
        <ExecutiveFilters options={options} param={param} currentYear={currentYear} dataYear={data.filters.year} isPending={isPending} applyExecutiveFilters={applyExecutiveFilters} />
        <p className="text-sm text-muted-foreground">Filtros aplicados: {data.filterSummary.join("; ")}</p>
        <p className="text-xs text-muted-foreground">Vendas consideradas: {salesDashboardRealizedStatuses.map(statusLabel).join(", ")}. Mês da venda: Previsão de Retirada.</p>
        {!data.summary.hasAnyTarget ? <Notice text="Meta de vendas não cadastrada para este ano." /> : null}
        {!data.summary.hasAnySales ? <Notice text="Nenhuma venda encontrada para os filtros selecionados." /> : null}
        {data.summary.ignoredIncompatibleOrders > 0 ? <Notice text={`${data.summary.ignoredIncompatibleOrders} pedido(s) com unidade incompatível foram desconsiderados do volume.`} /> : null}
        <ExecutiveKpis summary={data.summary} />
        <ExecutiveCharts chartData={chartData} />
        <MonthlyTable months={data.months} />
      </TabsContent>

      <TabsContent value="share" className="space-y-5">
        <ShareFilters options={options} share={customerShare} currentYear={currentYear} currentMonth={currentMonth} isPending={isPending} applyShareFilters={applyShareFilters} shareMonthHref={shareMonthHref} />
        <p className="text-sm text-muted-foreground">Filtros aplicados: {customerShare.filterSummary.join("; ")}</p>
        <ShareKpis share={customerShare} />
        {customerShare.topCustomer && customerShare.topCustomer.sharePercent > 50 ? <Notice text={`Alta concentração de vendas: o maior cliente representa ${formatPercent(customerShare.topCustomer.sharePercent)} do volume do mês.`} /> : null}
        {customerShare.top3ConcentrationPercent > 70 ? <Notice text={`Alta concentração no Top 3: os três maiores clientes representam ${formatPercent(customerShare.top3ConcentrationPercent)} do volume.`} /> : null}
        {customerShare.ignoredIncompatibleOrders > 0 ? <Notice text={`${customerShare.ignoredIncompatibleOrders} pedido(s) com unidade incompatível foram desconsiderados do share.`} /> : null}
        <section className="rounded-lg border bg-background p-5">
          <div className="mb-4"><h2 className="text-lg font-semibold">Volume de Vendas {monthLabels[customerShare.filters.month - 1]}/{customerShare.filters.year} — {formatTons(customerShare.totalVolumeScaled)} TONS</h2><p className="text-sm text-muted-foreground">Share por Cliente</p></div>
          {customerShare.totalVolumeScaled === 0 ? <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada para o período e filtros selecionados.</div> : <div className="grid gap-5 xl:grid-cols-[2fr_1fr]"><div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><Treemap data={treemapData} dataKey="size" nameKey="name" content={<TreemapBlock />} stroke="#ffffff"><Tooltip content={<ShareTooltip />} /></Treemap></ResponsiveContainer></div><ShareRanking items={customerShare.displayItems} /></div>}
        </section>
      </TabsContent>

      {data.canManageTargets ? <TabsContent value="targets" className="space-y-5"><TargetsForm year={data.filters.year} targets={targets} state={state} action={action} pending={targetPending} /></TabsContent> : null}
      <p className="text-right text-xs text-muted-foreground">Última atualização: {new Date().toLocaleString("pt-BR")}</p>
    </Tabs>
  );
}

function ExecutiveFilters({ options, param, currentYear, dataYear, isPending, applyExecutiveFilters }: { options: SalesDashboardPanelOptions; param: (name: string) => string; currentYear: number; dataYear: number; isPending: boolean; applyExecutiveFilters: (formData: FormData) => void }) {
  return <section className="rounded-lg border bg-background p-5"><form action={applyExecutiveFilters} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"><label className="text-sm font-medium">Ano<Input className="mt-1" name="year" type="number" min="2000" max="2100" defaultValue={param("year") || dataYear || currentYear} required /></label><SelectFilter label="Cliente" name="customerId" value={param("customerId")} options={options.customers} withCity /><SelectFilter label="Produto" name="productId" value={param("productId")} options={options.products} /><SelectFilter label="Tipo de Contrato" name="contractTypeId" value={param("contractTypeId")} options={options.contractTypes} /><SelectFilter label="Tipo de MP" name="rawMaterialClosingId" value={param("rawMaterialClosingId")} options={options.rawMaterialClosings} /><RepresentativeFilter name="representativeId" value={param("representativeId")} representatives={options.representatives} /><div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6"><Button disabled={isPending}>{isPending ? "Aplicando..." : "Aplicar filtros"}</Button><Button type="button" variant="outline" onClick={() => location.assign(`/dashboard/sales?year=${currentYear}`)}><RotateCcw size={18} />Limpar filtros</Button></div></form></section>;
}

type SalesDashboardPanelOptions = { customers: Option[]; products: Option[]; contractTypes: Option[]; rawMaterialClosings: Option[]; representatives: Array<{ id: string; fullName: string; active: boolean }> };

function ShareFilters({ options, share, currentYear, currentMonth, isPending, applyShareFilters, shareMonthHref }: { options: SalesDashboardPanelOptions; share: ShareData; currentYear: number; currentMonth: number; isPending: boolean; applyShareFilters: (formData: FormData) => void; shareMonthHref: (delta: number) => string }) {
  return <section className="rounded-lg border bg-background p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button asChild variant="outline" className="h-9 px-3"><a href={shareMonthHref(-1)}><ChevronLeft size={16} />Mês anterior</a></Button><span className="rounded-md border px-3 py-2 text-sm font-medium">{monthLabels[share.filters.month - 1]}/{share.filters.year}</span><Button asChild variant="outline" className="h-9 px-3"><a href={shareMonthHref(1)}>Próximo mês<ChevronRight size={16} /></a></Button></div></div><form action={applyShareFilters} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"><label className="text-sm font-medium">Mês<Input className="mt-1" name="shareMonth" type="number" min="1" max="12" defaultValue={share.filters.month} required /></label><label className="text-sm font-medium">Ano<Input className="mt-1" name="shareYear" type="number" min="2000" max="2100" defaultValue={share.filters.year} required /></label><SelectFilter label="Produto" name="shareProductId" value={share.filters.productId ?? ""} options={options.products} /><SelectFilter label="Tipo de Contrato" name="shareContractTypeId" value={share.filters.contractTypeId ?? ""} options={options.contractTypes} /><SelectFilter label="Tipo de MP" name="shareRawMaterialClosingId" value={share.filters.rawMaterialClosingId ?? ""} options={options.rawMaterialClosings} /><RepresentativeFilter name="shareRepresentativeId" value={share.filters.representativeId ?? ""} representatives={options.representatives} /><div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6"><Button disabled={isPending}>{isPending ? "Aplicando..." : "Aplicar filtros"}</Button><Button type="button" variant="outline" onClick={() => location.assign(`/dashboard/sales?shareMonth=${currentMonth}&shareYear=${currentYear}`)}><RotateCcw size={18} />Limpar filtros</Button></div></form></section>;
}

function ExecutiveKpis({ summary }: { summary: SalesDashboardSummary }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"><Kpi title="Meta acumulada" value={`${formatTons(summary.targetAccumulatedScaled)} tons`} /><Kpi title="Realizado acumulado" value={`${formatTons(summary.realizedAccumulatedScaled)} tons`} /><Kpi title="Percentual atingido" value={formatPercent(summary.percentAchieved)} tone={(summary.percentAchieved ?? 0) >= 100 ? "positive" : "negative"} /><Kpi title="Diferença" value={formatSignedTons(summary.differenceScaled)} tone={summary.differenceScaled >= 0 ? "positive" : "negative"} /><Kpi title="Meta anual" value={`${formatTons(summary.annualTargetScaled)} tons`} /><Kpi title="Projeção anual" value={summary.annualProjectionScaled === null ? "Sem vendas" : `${formatTons(summary.annualProjectionScaled)} tons`} /></section>;
}

function ShareKpis({ share }: { share: ShareData }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6"><Kpi title="Volume total" value={`${formatTons(share.totalVolumeScaled)} tons`} /><Kpi title="Clientes" value={String(share.customersCount)} /><Kpi title="Maior cliente" value={share.topCustomer?.name ?? "-"} /><Kpi title="Share do maior cliente" value={share.topCustomer ? formatPercent(share.topCustomer.sharePercent) : "-"} /><Kpi title="Pedidos" value={String(share.totalOrders)} /><Kpi title="Concentração Top 3" value={`${formatPercent(share.top3ConcentrationPercent)} · ${share.concentrationLabel}`} tone={share.top3ConcentrationPercent > 60 ? "negative" : share.top3ConcentrationPercent > 40 ? undefined : "positive"} /></section>;
}

function ExecutiveCharts({ chartData }: { chartData: Array<SalesDashboardMonth & { targetMonthly: number; realizedMonthly: number; targetAccumulated: number; realizedAccumulated: number | null }> }) {
  return <><section className="rounded-lg border bg-background p-5"><div className="mb-4"><h2 className="text-lg font-semibold">Evolução de Vendas — Volume em Toneladas</h2><p className="text-sm text-muted-foreground">Meta acumulada x Vendas realizadas acumuladas</p></div><div className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => new Intl.NumberFormat("pt-BR").format(Number(value))} /><Tooltip content={<DashboardTooltip />} /><Legend />{chartData.find((item) => item.isCurrentMonth) ? <ReferenceLine x={chartData.find((item) => item.isCurrentMonth)?.label} stroke="#64748b" strokeDasharray="4 4" label="Mês atual" /> : null}<Line type="monotone" dataKey="realizedAccumulated" name="Realizado acumulado" stroke="#0f6b99" strokeWidth={3} dot /><Line type="monotone" dataKey="targetAccumulated" name="Meta acumulada" stroke="#d97706" strokeWidth={3} dot /></LineChart></ResponsiveContainer></div></section><section className="rounded-lg border bg-background p-5"><div className="mb-4"><h2 className="text-lg font-semibold">Meta Mensal x Realizado Mensal</h2><p className="text-sm text-muted-foreground">Barras agrupadas por mês</p></div><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => new Intl.NumberFormat("pt-BR").format(Number(value))} /><Tooltip content={<DashboardTooltip monthly />} /><Legend /><Bar dataKey="targetMonthly" name="Meta mensal" fill="#d97706" radius={[4, 4, 0, 0]} /><Bar dataKey="realizedMonthly" name="Realizado mensal" fill="#0f6b99" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section></>;
}

function TargetsForm({ year, targets, state, action, pending }: { year: number; targets: TargetRow[]; state: SalesTargetActionState; action: (payload: FormData) => void; pending: boolean }) {
  return <section className="rounded-lg border bg-background p-5"><div><h2 className="text-lg font-semibold">Configuração de Metas</h2><p className="text-sm text-muted-foreground">Metas mensais e Realizado Manual em toneladas para {year}.</p></div><form action={action} className="mt-4 space-y-4"><input type="hidden" name="year" value={year} /><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Mês</th><th className="p-3">Cota / Meta</th><th className="p-3">Realizado Manual</th><th className="p-3">Origem</th></tr></thead><tbody>{targets.map((target) => <tr key={target.month} className="border-t"><td className="p-3 font-medium">{monthNames[target.month - 1]}</td><td className="p-3"><Input name={`target_${target.month}`} inputMode="decimal" pattern="[0-9.,]*" defaultValue={inputValue(target.targetTonsScaled)} placeholder="0,000" /></td><td className="p-3"><Input name={`manualActual_${target.month}`} inputMode="decimal" pattern="[0-9.,]*" defaultValue={optionalInputValue(target.manualActualTonsScaled)} placeholder="0,000" /></td><td className="p-3"><span className={target.manualActualTonsScaled === null ? "rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground" : "rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"}>{target.manualActualTonsScaled === null ? "AUTOMÁTICO" : "MANUAL"}</span></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center gap-2"><Button disabled={pending}><Save size={18} />{pending ? "Salvando..." : "Salvar metas"}</Button><Button type="reset" variant="outline">Limpar</Button>{state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}</div></form></section>;
}

function MonthlyTable({ months }: { months: SalesDashboardMonth[] }) {
  return <section className="rounded-lg border bg-background p-5"><h2 className="mb-4 text-lg font-semibold">Resumo mensal</h2><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Mês</th><th className="p-3">Meta Mensal</th><th className="p-3">Realizado Mensal</th><th className="p-3">Origem</th><th className="p-3">Diferença Mensal</th><th className="p-3">% Mensal</th><th className="p-3">Meta Acumulada</th><th className="p-3">Realizado Acumulado</th><th className="p-3">Diferença Acumulada</th><th className="p-3">% Acumulado</th></tr></thead><tbody>{months.map((item) => <tr key={item.month} className="border-t"><td className="p-3 font-medium">{item.label}</td><td className="p-3">{formatTons(item.targetMonthlyScaled)}</td><td className="p-3">{formatTons(item.realizedMonthlyScaled)}</td><td className="p-3">{item.realizedOrigin === "manual" ? "Manual" : "Pedidos"}</td><td className={item.monthlyDifferenceScaled >= 0 ? "p-3 text-emerald-700" : "p-3 text-red-700"}>{formatSignedTons(item.monthlyDifferenceScaled)}</td><td className="p-3">{formatPercent(item.monthlyPercent)}</td><td className="p-3">{formatTons(item.targetAccumulatedScaled)}</td><td className="p-3">{formatTons(item.realizedAccumulatedScaled)}</td><td className={item.accumulatedDifferenceScaled !== null && item.accumulatedDifferenceScaled >= 0 ? "p-3 text-emerald-700" : "p-3 text-red-700"}>{item.accumulatedDifferenceScaled === null ? "-" : formatSignedTons(item.accumulatedDifferenceScaled)}</td><td className="p-3">{formatPercent(item.accumulatedPercent)}</td></tr>)}</tbody></table></div></section>;
}

function ShareRanking({ items }: { items: CustomerShareItem[] }) {
  return <div className="rounded-md border"><div className="grid grid-cols-[44px_1fr_100px_76px_64px] gap-2 bg-muted p-3 text-xs font-medium"><span>#</span><span>Cliente</span><span>Volume</span><span>Share</span><span>Pedidos</span></div>{items.map((item) => <div key={item.id} className="grid grid-cols-[44px_1fr_100px_76px_64px] gap-2 border-t p-3 text-sm"><span>{item.ranking}</span><span className="font-medium">{item.name}</span><span>{formatTons(item.volumeScaled)}</span><span>{formatPercent(item.sharePercent)}</span><span>{item.ordersCount}</span></div>)}</div>;
}

function SelectFilter({ label, name, value, options, withCity = false }: { label: string; name: string; value: string; options: Option[]; withCity?: boolean }) {
  return <label className="text-sm font-medium">{label}<select name={name} defaultValue={value} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}{withCity && option.city ? ` - ${option.city}` : ""}{option.active ? "" : " (inativo)"}</option>)}</select></label>;
}

function RepresentativeFilter({ name, value, representatives }: { name: string; value: string; representatives: Array<{ id: string; fullName: string; active: boolean }> }) {
  if (representatives.length === 0) return null;
  return <label className="text-sm font-medium">Representante<select name={name} defaultValue={value} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos</option>{representatives.map((item) => <option key={item.id} value={item.id}>{item.fullName}{item.active ? "" : " (inativo)"}</option>)}</select></label>;
}

function Kpi({ title, value, tone }: { title: string; value: string; tone?: "positive" | "negative" }) {
  return <div className="rounded-lg border bg-background p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p><p className={tone === "positive" ? "mt-2 text-2xl font-semibold text-emerald-700" : tone === "negative" ? "mt-2 text-2xl font-semibold text-red-700" : "mt-2 text-2xl font-semibold"}>{value}</p></div>;
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">{text}</div>;
}

function DashboardTooltip({ active, payload, label, monthly = false }: { active?: boolean; payload?: Array<{ payload: SalesDashboardMonth; name: string; value: number }>; label?: string; monthly?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="rounded-md border bg-background p-3 text-sm shadow-sm"><p className="font-medium">{label}</p><p>Meta mensal: {formatTons(row.targetMonthlyScaled)} tons</p><p>Realizado mensal: {formatTons(row.realizedMonthlyScaled)} tons</p>{!monthly ? <><p>Meta acumulada: {formatTons(row.targetAccumulatedScaled)} tons</p><p>Realizado acumulado: {formatTons(row.realizedAccumulatedScaled)} tons</p><p>Diferença acumulada: {row.accumulatedDifferenceScaled === null ? "-" : formatSignedTons(row.accumulatedDifferenceScaled)}</p><p>Percentual: {formatPercent(row.accumulatedPercent)}</p></> : null}</div>;
}

function ShareTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CustomerShareItem }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return <div className="max-w-xs rounded-md border bg-background p-3 text-sm shadow-sm"><p className="font-medium">{item.isOthers ? "Grupo" : "Cliente"}: {item.name}</p><p>Volume vendido: {formatTons(item.volumeScaled)} tons</p><p>Share: {formatPercent(item.sharePercent)}</p>{item.isOthers ? <><p>Clientes agrupados: {item.groupedCustomersCount ?? 0}</p>{item.groupedCustomers?.length ? <p className="text-xs text-muted-foreground">{item.groupedCustomers.join(", ")}</p> : null}</> : <><p>Pedidos: {item.ordersCount}</p><p>Ranking: {item.ranking}º</p></>}</div>;
}

function TreemapBlock(props: { x?: number; y?: number; width?: number; height?: number; name?: string; sharePercent?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", sharePercent = 0, fill = "#0f6b99" } = props;
  const showLabel = width > 90 && height > 48;
  return <g><rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />{showLabel ? <><text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={600}>{name.length > 18 ? `${name.slice(0, 17)}…` : name}</text><text x={x + 8} y={y + 38} fill="#fff" fontSize={12}>{formatPercent(sharePercent, 0)}</text></> : null}</g>;
}
