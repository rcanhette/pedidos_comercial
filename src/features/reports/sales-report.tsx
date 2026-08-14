"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, FileText, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTimeBr, formatMoneyCents, formatMonthYearBr } from "@/lib/format";
import { activeOrderStatusOptions, orderStatusLabels } from "@/lib/constants";
import { formatQuantityScaled } from "@/lib/scalars";
import type { SalesReportOrder } from "@/server/sales-report-service";

type Option = { id: string; name: string; active: boolean; city?: string };

export function SalesReport({
  orders,
  total,
  page,
  pageSize,
  totalPages,
  filterSummary,
  options,
  error
}: {
  orders: SalesReportOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filterSummary: string[];
  options: {
    customers: Option[];
    products: Option[];
    contractTypes: Option[];
    rawMaterialClosings: Option[];
  };
  error?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function param(name: string) {
    return searchParams.get(name) ?? "";
  }

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `/reports?${params.toString()}`;
  }

  function sortHref(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    const currentSort = params.get("sort") || "solicitationAt";
    const currentDirection = params.get("direction") || "desc";
    params.set("sort", sort);
    params.set("direction", currentSort === sort && currentDirection === "asc" ? "desc" : "asc");
    params.set("page", "1");
    return `/reports?${params.toString()}`;
  }

  function handleSubmit(formData: FormData) {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) params.set(key, value);
    }
    params.set("page", "1");
    params.set("sort", param("sort") || "solicitationAt");
    params.set("direction", param("direction") || "desc");
    startTransition(() => router.push(`/reports?${params.toString()}`));
  }

  async function exportFile(format: "excel" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      const response = await fetch(`/api/reports/sales/${format}?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Não foi possível gerar o arquivo.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `relatorio-vendas.${format === "excel" ? "xlsx" : "pdf"}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erro ao gerar arquivo.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      <form action={handleSubmit} className="rounded-lg border bg-background p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium">
            Pedido SAP
            <Input className="mt-1" name="pedidoSap" defaultValue={param("pedidoSap")} placeholder="SAP-2026-001" />
          </label>
          <SelectFilter label="Cliente" name="customerId" value={param("customerId")} options={options.customers} withCity />
          <SelectFilter label="Produto" name="productId" value={param("productId")} options={options.products} />
          <SelectFilter label="Tipo de Contrato" name="contractTypeId" value={param("contractTypeId")} options={options.contractTypes} />
          <SelectFilter label="Tipo de MP" name="rawMaterialClosingId" value={param("rawMaterialClosingId")} options={options.rawMaterialClosings} />
          <StatusFilter value={param("status")} />
          <label className="text-sm font-medium">
            Data de criação inicial
            <Input className="mt-1" type="date" name="createdFrom" defaultValue={param("createdFrom")} />
          </label>
          <label className="text-sm font-medium">
            Data de criação final
            <Input className="mt-1" type="date" name="createdTo" defaultValue={param("createdTo")} />
          </label>
          <label className="text-sm font-medium">
            Previsão de retirada
            <Input className="mt-1" type="month" name="pickupForecast" defaultValue={param("pickupForecast")} />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={isPending}>
            <Filter size={18} />
            {isPending ? "Filtrando..." : "Filtrar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => startTransition(() => router.push("/reports"))} disabled={isPending}>
            <RotateCcw size={18} />
            Limpar filtros
          </Button>
          <Button type="button" variant="outline" onClick={() => exportFile("excel")} disabled={exporting !== null}>
            <FileSpreadsheet size={18} />
            {exporting === "excel" ? "Gerando arquivo..." : "Exportar Excel"}
          </Button>
          <Button type="button" variant="outline" onClick={() => exportFile("pdf")} disabled={exporting !== null}>
            <FileText size={18} />
            {exporting === "pdf" ? "Gerando arquivo..." : "Exportar PDF"}
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Filtros aplicados: {filterSummary.join("; ")}</p>
        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {exportError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{exportError}</p> : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Mostrando {first} a {last} de {total} pedidos</span>
        <span>Página {page} de {totalPages}</span>
      </div>

      <SalesReportTable orders={orders} sortHref={sortHref} />

      <Pagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </div>
  );
}

function SelectFilter({ label, name, value, options, withCity = false }: { label: string; name: string; value: string; options: Option[]; withCity?: boolean }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select name={name} defaultValue={value} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}{withCity && option.city ? ` - ${option.city}` : ""}{option.active ? "" : " (inativo)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusFilter({ value }: { value: string }) {
  return (
    <label className="text-sm font-medium">
      Status
      <select name="status" defaultValue={value} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Todos</option>
        {activeOrderStatusOptions.map((status) => (
          <option key={status} value={status}>{orderStatusLabels[status]}</option>
        ))}
      </select>
    </label>
  );
}

function SortLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:underline">
      {children}
    </Link>
  );
}

function SalesReportTable({ orders, sortHref }: { orders: SalesReportOrder[]; sortHref: (sort: string) => string }) {
  if (orders.length === 0) {
    return <div className="rounded-lg border bg-background p-8 text-center text-muted-foreground">Nenhum pedido encontrado para os filtros selecionados.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[1320px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-3"><SortLink href={sortHref("sapOrderNumber")}>Pedido SAP</SortLink></th>
            <th className="p-3"><SortLink href={sortHref("solicitationAt")}>Data de Criação</SortLink></th>
            <th className="p-3">Representante</th>
            <th className="p-3"><SortLink href={sortHref("customerName")}>Cliente</SortLink></th>
            <th className="p-3"><SortLink href={sortHref("productNameSnapshot")}>Produto</SortLink></th>
            <th className="p-3">Tipo de Contrato</th>
            <th className="p-3">Tipo de MP</th>
            <th className="p-3">Quantidade</th>
            <th className="p-3">Moeda</th>
            <th className="p-3">Valor Unitário</th>
            <th className="p-3"><SortLink href={sortHref("pickupForecast")}>Previsão de Retirada</SortLink></th>
            <th className="p-3"><SortLink href={sortHref("status")}>Status</SortLink></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t">
              <td className="p-3 font-medium">{order.sapOrderNumber || "Não informado"}</td>
              <td className="p-3">{formatDateTimeBr(order.solicitationAt)}</td>
              <td className="p-3">{order.representativeName || "Não informado"}</td>
              <td className="p-3">{order.customerName || "Não informado"}</td>
              <td className="p-3">{order.productNameSnapshot || "Não informado"}</td>
              <td className="p-3">{order.contractTypeNameSnapshot || "Não informado"}</td>
              <td className="p-3">{order.rawMaterialClosingNameSnapshot || "Não informado"}</td>
              <td className="p-3">{formatQuantityScaled(order.quantityScaled)}</td>
              <td className="p-3">{order.currencyCodeSnapshot || "Não informado"}</td>
              <td className="p-3">{formatMoneyCents(order.unitPriceCents, order.currencyCodeSnapshot || "BRL")}</td>
              <td className="p-3">{formatMonthYearBr(order.pickupForecast)}</td>
              <td className="p-3"><StatusBadge status={order.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, pageHref }: { page: number; totalPages: number; pageHref: (page: number) => string }) {
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button asChild variant="outline" className="h-9 px-3" disabled={page <= 1}>
        <Link href={pageHref(1)}>Primeira página</Link>
      </Button>
      <Button asChild variant="outline" className="h-9 px-3" disabled={page <= 1}>
        <Link href={pageHref(Math.max(1, page - 1))}>Página anterior</Link>
      </Button>
      {pages.map((item) => (
        <Button key={item} asChild variant={item === page ? "default" : "outline"} className="h-9 w-9 px-0">
          <Link href={pageHref(item)}>{item}</Link>
        </Button>
      ))}
      <Button asChild variant="outline" className="h-9 px-3" disabled={page >= totalPages}>
        <Link href={pageHref(Math.min(totalPages, page + 1))}>Próxima página</Link>
      </Button>
      <Button asChild variant="outline" className="h-9 px-3" disabled={page >= totalPages}>
        <Link href={pageHref(totalPages)}>Última página</Link>
      </Button>
      <Download size={16} className="sr-only" />
    </div>
  );
}
