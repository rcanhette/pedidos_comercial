"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, FileText, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBr, formatMoneyCents, formatMonthYearBr } from "@/lib/format";
import { formatQuantityScaledFixed } from "@/lib/scalars";
import { technicalListReportCommission, technicalListReportRepresentative } from "@/lib/technical-list-report";
import type { TechnicalListReportItem } from "@/server/technical-list-report-service";

type RawMaterialOption = { id: string; name: string; active: boolean };

export function TechnicalListReport({ items, total, page, pageSize, totalPages, filterSummary, rawMaterials, error }: { items: TechnicalListReportItem[]; total: number; page: number; pageSize: number; totalPages: number; filterSummary: string[]; rawMaterials: RawMaterialOption[]; error?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  function param(name: string) { return searchParams.get(name) ?? ""; }
  function pageHref(nextPage: number) { const params = new URLSearchParams(searchParams.toString()); params.set("page", String(nextPage)); return `/reports/technical-list?${params.toString()}`; }
  function sortHref(sort: string) { const params = new URLSearchParams(searchParams.toString()); const currentSort = params.get("sort") || "solicitationAt"; const currentDirection = params.get("direction") || "desc"; params.set("sort", sort); params.set("direction", currentSort === sort && currentDirection === "asc" ? "desc" : "asc"); params.set("page", "1"); return `/reports/technical-list?${params.toString()}`; }
  function handleSubmit(formData: FormData) { const params = new URLSearchParams(); for (const [key, value] of formData.entries()) if (typeof value === "string" && value.trim()) params.set(key, value); params.set("page", "1"); params.set("sort", param("sort") || "solicitationAt"); params.set("direction", param("direction") || "desc"); startTransition(() => router.push(`/reports/technical-list?${params.toString()}`)); }
  async function exportFile(format: "excel" | "pdf") { setExporting(format); setExportError(null); try { const params = new URLSearchParams(searchParams.toString()); params.delete("page"); const response = await fetch(`/api/reports/technical-list/${format}?${params.toString()}`); if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.message || "Não foi possível gerar o arquivo."); } const blob = await response.blob(); const disposition = response.headers.get("content-disposition") || ""; const match = disposition.match(/filename="([^"]+)"/); const filename = match?.[1] || `relatorio-lista-tecnica.${format === "excel" ? "xlsx" : "pdf"}`; const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); } catch (err) { setExportError(err instanceof Error ? err.message : "Erro ao gerar arquivo."); } finally { setExporting(null); } }
  return <div className="space-y-5">
    <form action={handleSubmit} className="rounded-lg border bg-background p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Pedido SAP<Input className="mt-1" name="pedidoSap" defaultValue={param("pedidoSap")} placeholder="SAP-2026-001" /></label>
        <label className="text-sm font-medium">Data de criação inicial<Input className="mt-1" type="date" name="createdFrom" defaultValue={param("createdFrom")} /></label>
        <label className="text-sm font-medium">Data de criação final<Input className="mt-1" type="date" name="createdTo" defaultValue={param("createdTo")} /></label>
        <label className="text-sm font-medium">Matéria-prima<select name="rawMaterialId" defaultValue={param("rawMaterialId")} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todas</option>{rawMaterials.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inativa)"}</option>)}</select></label>
        <label className="text-sm font-medium">Previsão inicial<Input className="mt-1" type="month" name="pickupFrom" defaultValue={param("pickupFrom")} /></label>
        <label className="text-sm font-medium">Previsão final<Input className="mt-1" type="month" name="pickupTo" defaultValue={param("pickupTo")} /></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Button disabled={isPending}><Filter size={18} />{isPending ? "Filtrando..." : "Filtrar"}</Button><Button type="button" variant="outline" onClick={() => startTransition(() => router.push("/reports/technical-list"))} disabled={isPending}><RotateCcw size={18} />Limpar filtros</Button><Button type="button" variant="outline" onClick={() => exportFile("excel")} disabled={exporting !== null}><FileSpreadsheet size={18} />{exporting === "excel" ? "Gerando arquivo..." : "Exportar Excel"}</Button><Button type="button" variant="outline" onClick={() => exportFile("pdf")} disabled={exporting !== null}><FileText size={18} />{exporting === "pdf" ? "Gerando arquivo..." : "Exportar PDF"}</Button></div>
      <p className="mt-4 text-sm text-muted-foreground">Filtros aplicados: {filterSummary.join("; ")}</p>{error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}{exportError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{exportError}</p> : null}
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>Mostrando {first} a {last} de {total} itens</span><span>Página {page} de {totalPages}</span></div>
    <ReportTable items={items} sortHref={sortHref} />
    <Pagination page={page} totalPages={totalPages} pageHref={pageHref} />
    <Download size={16} className="sr-only" />
  </div>;
}

function SortLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link href={href} className="inline-flex items-center gap-1 hover:underline">{children}</Link>; }
function ReportTable({ items, sortHref }: { items: TechnicalListReportItem[]; sortHref: (sort: string) => string }) { if (items.length === 0) return <div className="rounded-lg border bg-background p-8 text-center text-muted-foreground">Nenhum item de Lista Técnica encontrado para os filtros selecionados.</div>; return <div className="overflow-x-auto rounded-lg border bg-background"><table className="w-full min-w-[1380px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3"><SortLink href={sortHref("sapOrderNumber")}>Pedido SAP</SortLink></th><th className="p-3">Cliente</th><th className="p-3">Representante</th><th className="p-3"><SortLink href={sortHref("solicitationAt")}>Data de Criação</SortLink></th><th className="p-3"><SortLink href={sortHref("pickupForecast")}>Previsão de Retirada</SortLink></th><th className="p-3"><SortLink href={sortHref("rawMaterialNameSnapshot")}>Matéria-prima</SortLink></th><th className="p-3">Quantidade em KG</th><th className="p-3">Quantidade em TONS</th><th className="p-3">Preço</th><th className="p-3">Comissão</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.order.sapOrderNumber || "Não informado"}</td><td className="p-3">{item.order.customerName || "Não informado"}</td><td className="p-3">{technicalListReportRepresentative(item)}</td><td className="p-3">{formatDateTimeBr(item.order.solicitationAt)}</td><td className="p-3">{formatMonthYearBr(item.order.pickupForecast)}</td><td className="p-3">{item.rawMaterialNameSnapshot || "Não informado"}</td><td className="p-3">{formatQuantityScaledFixed(item.quantityKgScaled)}</td><td className="p-3">{formatQuantityScaledFixed(item.quantityTonsScaled)}</td><td className="p-3">{formatMoneyCents(item.priceCents, item.order.currencyCodeSnapshot)}</td><td className="p-3">{technicalListReportCommission(item)}</td></tr>)}</tbody></table></div>; }
function Pagination({ page, totalPages, pageHref }: { page: number; totalPages: number; pageHref: (page: number) => string }) { const start = Math.max(1, page - 2); const end = Math.min(totalPages, page + 2); const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index); return <div className="flex flex-wrap items-center justify-center gap-2"><Button asChild variant="outline" className="h-9 px-3" disabled={page <= 1}><Link href={pageHref(1)}>Primeira página</Link></Button><Button asChild variant="outline" className="h-9 px-3" disabled={page <= 1}><Link href={pageHref(Math.max(1, page - 1))}>Página anterior</Link></Button>{pages.map((item) => <Button key={item} asChild variant={item === page ? "default" : "outline"} className="h-9 w-9 px-0"><Link href={pageHref(item)}>{item}</Link></Button>)}<Button asChild variant="outline" className="h-9 px-3" disabled={page >= totalPages}><Link href={pageHref(Math.min(totalPages, page + 1))}>Próxima página</Link></Button><Button asChild variant="outline" className="h-9 px-3" disabled={page >= totalPages}><Link href={pageHref(totalPages)}>Última página</Link></Button></div>; }
