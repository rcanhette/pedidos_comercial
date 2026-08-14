"use client";

import Link from "next/link";
import type { Order } from "@prisma/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdersTable } from "./orders-table";
import { activeOrderStatusOptions, orderStatusLabels } from "@/lib/constants";

type Option = { id: string; name: string; active: boolean; city?: string };
type RepresentativeOption = { id: string; fullName: string; active: boolean };

export function OrdersList({
  orders,
  total,
  page,
  pageSize,
  totalPages,
  showRepresentative = false,
  currentUser,
  options,
  error
}: {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  showRepresentative?: boolean;
  currentUser: { id: string; permissions: string[] };
  options: {
    customers: Option[];
    products: Option[];
    contractTypes: Option[];
    rawMaterialClosings: Option[];
    representatives: RepresentativeOption[];
  };
  error?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function param(name: string) {
    return searchParams.get(name) ?? "";
  }

  function pageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `${pathname}?${params.toString()}`;
  }

  function handleSubmit(formData: FormData) {
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) params.set(key, value);
    }
    params.set("page", "1");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="space-y-5">
      <form action={handleSubmit} className="rounded-lg border bg-background p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusFilter value={param("status")} />
          <label className="text-sm font-medium">
            Pedido SAP
            <Input className="mt-1" name="pedidoSap" defaultValue={param("pedidoSap")} placeholder="SAP-2026-001" />
          </label>
          <label className="text-sm font-medium">
            Data de criação inicial
            <Input className="mt-1" type="date" name="createdFrom" defaultValue={param("createdFrom")} />
          </label>
          <label className="text-sm font-medium">
            Data de criação final
            <Input className="mt-1" type="date" name="createdTo" defaultValue={param("createdTo")} />
          </label>
          <label className="text-sm font-medium">
            Previsão inicial
            <Input className="mt-1" type="month" name="pickupFrom" defaultValue={param("pickupFrom")} />
          </label>
          <label className="text-sm font-medium">
            Previsão final
            <Input className="mt-1" type="month" name="pickupTo" defaultValue={param("pickupTo")} />
          </label>
          <SelectFilter label="Cliente" name="customerId" value={param("customerId")} options={options.customers} withCity />
          <SelectFilter label="Produto" name="productId" value={param("productId")} options={options.products} />
          <SelectFilter label="Tipo de Contrato" name="contractTypeId" value={param("contractTypeId")} options={options.contractTypes} />
          <SelectFilter label="Tipo de MP" name="rawMaterialClosingId" value={param("rawMaterialClosingId")} options={options.rawMaterialClosings} />
          {showRepresentative ? <RepresentativeFilter value={param("representativeId")} representatives={options.representatives} /> : null}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={isPending}>
            <Filter size={18} />
            {isPending ? "Filtrando..." : "Filtrar"}
          </Button>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => startTransition(() => router.push(pathname))}>
            <RotateCcw size={18} />
            Limpar filtros
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </div>
        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Mostrando {first} a {last} de {total} pedidos</span>
        <span>Página {page} de {totalPages}</span>
      </div>

      <OrdersTable orders={orders} showRepresentative={showRepresentative} currentUser={currentUser} emptyMessage="Nenhum pedido encontrado para os filtros selecionados." />
      <Pagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </div>
  );
}

function StatusFilter({ value }: { value: string }) {
  return (
    <label className="text-sm font-medium">
      Etapa
      <select name="status" defaultValue={value} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Todas</option>
        {activeOrderStatusOptions.map((status) => (
          <option key={status} value={status}>{orderStatusLabels[status]}</option>
        ))}
      </select>
    </label>
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

function RepresentativeFilter({ value, representatives }: { value: string; representatives: RepresentativeOption[] }) {
  return (
    <label className="text-sm font-medium">
      Representante
      <select name="representativeId" defaultValue={value} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Todos</option>
        {representatives.map((representative) => (
          <option key={representative.id} value={representative.id}>
            {representative.fullName}{representative.active ? "" : " (inativo)"}
          </option>
        ))}
      </select>
    </label>
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
    </div>
  );
}
