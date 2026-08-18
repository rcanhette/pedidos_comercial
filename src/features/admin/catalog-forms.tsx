"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { ContractType, Currency, Customer, Package, Product, RawMaterial, RawMaterialClosing, SalesResponsible } from "@prisma/client";
import { createContractTypeAction, createCurrencyAction, createCustomerAction, createPackageAction, createProductAction, createRawMaterialAction, createRawMaterialClosingAction, createSalesResponsibleAction, deleteContractTypeAction, deleteCurrencyAction, deleteCustomerAction, deletePackageAction, deleteProductAction, deleteRawMaterialAction, deleteRawMaterialClosingAction, deleteSalesResponsibleAction, updateContractTypeAction, updateCurrencyAction, updateCustomerAction, updatePackageAction, updateProductAction, updateRawMaterialAction, updateRawMaterialClosingAction, updateSalesResponsibleAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogListResult } from "@/server/catalog-service";
import { quantityScaledToDecimal } from "@/lib/scalars";

const initialState: ActionState = { ok: false };

type CatalogManagerProps<T> = CatalogListResult<T> & {
  canEdit: boolean;
  canDelete: boolean;
};

function catalogPageHref(pathname: string, search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function CatalogListControls({ search, page, total, totalPages, pageSize }: Pick<CatalogListResult<unknown>, "search" | "page" | "total" | "totalPages" | "pageSize">) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(search);

  useEffect(() => setValue(search), [search]);

  useEffect(() => {
    if (value === search) return;
    const timeout = window.setTimeout(() => {
      startTransition(() => router.replace(catalogPageHref(pathname, value.trim(), 1)));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [pathname, router, search, value]);

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
      <div className="min-w-[240px] flex-1">
        <Input aria-label="Pesquisar cadastro" placeholder="Pesquisar" value={value} onChange={(event) => setValue(event.target.value)} normalizeUppercase />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{pending ? "Pesquisando..." : `${first}-${last} de ${total}`}</span>
        {page <= 1 ? (
          <Button variant="outline" className="h-8 px-3" disabled>Anterior</Button>
        ) : (
          <Button asChild variant="outline" className="h-8 px-3">
            <Link href={catalogPageHref(pathname, search, page - 1)}>Anterior</Link>
          </Button>
        )}
        <span>Página {page} de {totalPages}</span>
        {page >= totalPages ? (
          <Button variant="outline" className="h-8 px-3" disabled>Próxima</Button>
        ) : (
          <Button asChild variant="outline" className="h-8 px-3">
            <Link href={catalogPageHref(pathname, search, page + 1)}>Próxima</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function CustomerForm() {
  const [state, action, pending] = useActionState(createCustomerAction, initialState);
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-background p-5 md:grid-cols-4">
      <Input name="name" placeholder="Cliente" normalizeUppercase required />
      <Input name="city" placeholder="Cidade" normalizeUppercase required />
      <Input name="cnpj" placeholder="CNPJ" required />
      <input type="hidden" name="active" value="true" />
      <Button disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

function CustomerRow({ item, canEdit, canDelete }: { item: Customer; canEdit: boolean; canDelete: boolean }) {
  const updateAction = updateCustomerAction.bind(null, item.id);
  const deleteAction = deleteCustomerAction.bind(null, item.id);
  const [state, action, pending] = useActionState(updateAction, initialState);
  return (
    <div className="grid gap-3 border-t p-3 md:grid-cols-[1.6fr_1fr_1fr_auto]">
      <form id={`customer-${item.id}`} action={action} className="contents">
        <Input name="name" defaultValue={item.name} disabled={!canEdit} normalizeUppercase required />
        <Input name="city" defaultValue={item.city} disabled={!canEdit} normalizeUppercase required />
        <Input name="cnpj" defaultValue={item.cnpj} disabled={!canEdit} required />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="active" value="false" />
            <input type="checkbox" name="active" value="true" defaultChecked={item.active} disabled={!canEdit} />
            Ativo
          </label>
          {canEdit ? <Button form={`customer-${item.id}`} disabled={pending} className="h-8 px-3">{pending ? "Salvando..." : "Salvar"}</Button> : null}
        </div>
      </form>
      <div className="md:col-span-4">
        <div className="flex items-center justify-between gap-3">
          {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : <span />}
          {canDelete ? (
            <form action={deleteAction}>
              <Button
                type="submit"
                variant="destructive"
                className="h-8 px-3"
                onClick={(event) => {
                  if (!confirm("Excluir este cliente? Se estiver em uso, ele será inativado.")) event.preventDefault();
                }}
              >
                Excluir
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CustomerManager({ items: customers, canEdit, canDelete, search, page, total, totalPages, pageSize }: CatalogManagerProps<Customer>) {
  return (
    <div className="rounded-lg border bg-background">
      <CatalogListControls search={search} page={page} total={total} totalPages={totalPages} pageSize={pageSize} />
      <div className="grid gap-3 bg-muted p-3 text-sm font-medium md:grid-cols-[1.6fr_1fr_1fr_auto]">
        <span>Cliente</span><span>Cidade</span><span>CNPJ</span><span className="text-right">Ações</span>
      </div>
      {customers.map((item) => <CustomerRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} />)}
    </div>
  );
}

export function ProductForm() {
  const [state, action, pending] = useActionState(createProductAction, initialState);
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-background p-5 md:grid-cols-4">
      <Input name="name" placeholder="Nome" normalizeUppercase required />
      <Input name="unit" placeholder="Unidade" normalizeUppercase required />
      <Input name="description" placeholder="Descrição" className="md:col-span-2" normalizeUppercase />
      <input type="hidden" name="active" value="true" />
      <Button disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

function ProductRow({ item, canEdit, canDelete }: { item: Product; canEdit: boolean; canDelete: boolean }) {
  const updateAction = updateProductAction.bind(null, item.id);
  const deleteAction = deleteProductAction.bind(null, item.id);
  const [state, action, pending] = useActionState(updateAction, initialState);
  return (
    <div className="grid gap-3 border-t p-3 md:grid-cols-[1.4fr_1fr_1.6fr_auto]">
      <form id={`product-${item.id}`} action={action} className="contents">
        <Input name="name" defaultValue={item.name} disabled={!canEdit} normalizeUppercase required />
        <Input name="unit" defaultValue={item.unit} disabled={!canEdit} normalizeUppercase required />
        <Input name="description" defaultValue={item.description ?? ""} disabled={!canEdit} placeholder="Descrição" normalizeUppercase />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="active" value="false" />
            <input type="checkbox" name="active" value="true" defaultChecked={item.active} disabled={!canEdit} />
            Ativo
          </label>
          {canEdit ? <Button form={`product-${item.id}`} disabled={pending} className="h-8 px-3">{pending ? "Salvando..." : "Salvar"}</Button> : null}
        </div>
      </form>
      <div className="md:col-span-4">
        <div className="flex items-center justify-between gap-3">
          {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : <span />}
          {canDelete ? (
            <form action={deleteAction}>
              <Button
                type="submit"
                variant="destructive"
                className="h-8 px-3"
                onClick={(event) => {
                  if (!confirm("Excluir este produto? Se estiver em uso, ele será inativado.")) event.preventDefault();
                }}
              >
                Excluir
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProductManager({ items: products, canEdit, canDelete, search, page, total, totalPages, pageSize }: CatalogManagerProps<Product>) {
  return (
    <div className="rounded-lg border bg-background">
      <CatalogListControls search={search} page={page} total={total} totalPages={totalPages} pageSize={pageSize} />
      <div className="grid gap-3 bg-muted p-3 text-sm font-medium md:grid-cols-[1.4fr_1fr_1.6fr_auto]">
        <span>Nome</span><span>Unidade</span><span>Descrição</span><span className="text-right">Ações</span>
      </div>
      {products.map((item) => <ProductRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} />)}
    </div>
  );
}

export function PackageForm() {
  const [state, action, pending] = useActionState(createPackageAction, initialState);
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-background p-5 md:grid-cols-6">
      <Input name="name" placeholder="Nome" normalizeUppercase required />
      <Input name="capacity" placeholder="Capacidade" />
      <Input name="unit" placeholder="Unidade" normalizeUppercase />
      <Input name="weight" placeholder="Peso" />
      <Input name="description" placeholder="Descrição" className="md:col-span-2" normalizeUppercase />
      <input type="hidden" name="active" value="true" />
      <Button disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

export function CurrencyForm() {
  const [state, action, pending] = useActionState(createCurrencyAction, initialState);
  return (
    <form action={action} className="grid gap-3 rounded-lg border bg-background p-5 md:grid-cols-5">
      <Input name="name" placeholder="Nome" normalizeUppercase required />
      <Input name="code" placeholder="Código ISO" normalizeUppercase required maxLength={3} />
      <Input name="symbol" placeholder="Símbolo" normalizeUppercase required />
      <Input name="decimalPlaces" placeholder="Casas decimais" type="number" defaultValue={2} required />
      <input type="hidden" name="active" value="true" />
      <Button disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}


function decimalValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

function PackageRow({ item, canEdit, canDelete }: { item: Package; canEdit: boolean; canDelete: boolean }) {
  const updateAction = updatePackageAction.bind(null, item.id);
  const deleteAction = deletePackageAction.bind(null, item.id);
  const [state, action, pending] = useActionState(updateAction, initialState);
  return (
    <div className="grid gap-3 border-t p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_auto]">
      <form id={`package-${item.id}`} action={action} className="contents">
        <Input name="name" defaultValue={item.name} disabled={!canEdit} normalizeUppercase required />
        <Input name="capacity" defaultValue={decimalValue(quantityScaledToDecimal(item.capacityScaled))} disabled={!canEdit} placeholder="Capacidade" />
        <Input name="unit" defaultValue={item.unit ?? ""} disabled={!canEdit} placeholder="Unidade" normalizeUppercase />
        <Input name="weight" defaultValue={decimalValue(quantityScaledToDecimal(item.weightScaled))} disabled={!canEdit} placeholder="Peso" />
        <Input name="description" defaultValue={item.description ?? ""} disabled={!canEdit} placeholder="Descrição" normalizeUppercase />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="active" value="false" />
            <input type="checkbox" name="active" value="true" defaultChecked={item.active} disabled={!canEdit} />
            Ativo
          </label>
          {canEdit ? <Button form={`package-${item.id}`} disabled={pending} className="h-8 px-3">{pending ? "Salvando..." : "Salvar"}</Button> : null}
        </div>
      </form>
      <div className="md:col-span-6">
        <div className="flex items-center justify-between gap-3">
          {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : <span />}
          {canDelete ? (
            <form action={deleteAction}>
              <Button
                type="submit"
                variant="destructive"
                className="h-8 px-3"
                onClick={(event) => {
                  if (!confirm("Excluir esta embalagem? Se estiver em uso, ela será inativada.")) event.preventDefault();
                }}
              >
                Excluir
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PackageManager({ items: packages, canEdit, canDelete, search, page, total, totalPages, pageSize }: CatalogManagerProps<Package>) {
  return (
    <div className="rounded-lg border bg-background">
      <CatalogListControls search={search} page={page} total={total} totalPages={totalPages} pageSize={pageSize} />
      <div className="grid gap-3 bg-muted p-3 text-sm font-medium md:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_auto]">
        <span>Nome</span><span>Capacidade</span><span>Unidade</span><span>Peso</span><span>Descrição</span><span className="text-right">Ações</span>
      </div>
      {packages.map((item) => <PackageRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} />)}
    </div>
  );
}

function CurrencyRow({ item, canEdit, canDelete }: { item: Currency; canEdit: boolean; canDelete: boolean }) {
  const updateAction = updateCurrencyAction.bind(null, item.id);
  const deleteAction = deleteCurrencyAction.bind(null, item.id);
  const [state, action, pending] = useActionState(updateAction, initialState);
  return (
    <div className="grid gap-3 border-t p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <form id={`currency-${item.id}`} action={action} className="contents">
        <Input name="code" defaultValue={item.code} disabled={!canEdit} normalizeUppercase required maxLength={3} />
        <Input name="name" defaultValue={item.name} disabled={!canEdit} normalizeUppercase required />
        <Input name="symbol" defaultValue={item.symbol} disabled={!canEdit} normalizeUppercase required />
        <Input name="decimalPlaces" type="number" defaultValue={item.decimalPlaces} disabled={!canEdit} required />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="active" value="false" />
            <input type="checkbox" name="active" value="true" defaultChecked={item.active} disabled={!canEdit} />
            Ativo
          </label>
          {canEdit ? <Button form={`currency-${item.id}`} disabled={pending} className="h-8 px-3">{pending ? "Salvando..." : "Salvar"}</Button> : null}
        </div>
      </form>
      <div className="md:col-span-5">
        <div className="flex items-center justify-between gap-3">
          {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : <span />}
          {canDelete ? (
            <form action={deleteAction}>
              <Button
                type="submit"
                variant="destructive"
                className="h-8 px-3"
                onClick={(event) => {
                  if (!confirm("Excluir esta moeda? Se estiver em uso, ela será inativada.")) event.preventDefault();
                }}
              >
                Excluir
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CurrencyManager({ items: currencies, canEdit, canDelete, search, page, total, totalPages, pageSize }: CatalogManagerProps<Currency>) {
  return (
    <div className="rounded-lg border bg-background">
      <CatalogListControls search={search} page={page} total={total} totalPages={totalPages} pageSize={pageSize} />
      <div className="grid gap-3 bg-muted p-3 text-sm font-medium md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <span>Código</span><span>Nome</span><span>Símbolo</span><span>Casas decimais</span><span className="text-right">Ações</span>
      </div>
      {currencies.map((item) => <CurrencyRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} />)}
    </div>
  );
}


type SimpleItem = ContractType | RawMaterialClosing | RawMaterial | SalesResponsible;

function SimpleCatalogForm({ action, placeholder }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; placeholder: string }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-3 rounded-lg border bg-background p-5 md:grid-cols-[1fr_auto]">
      <Input name="name" placeholder={placeholder} normalizeUppercase required />
      <input type="hidden" name="active" value="true" />
      <Button disabled={pending}>{pending ? "Salvando..." : "Cadastrar"}</Button>
      {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : null}
    </form>
  );
}

function SimpleCatalogRow({ item, canEdit, canDelete, updateAction, deleteAction, label }: { item: SimpleItem; canEdit: boolean; canDelete: boolean; updateAction: (id: string, state: ActionState, formData: FormData) => Promise<ActionState>; deleteAction: (id: string) => Promise<void>; label: string }) {
  const boundUpdate = updateAction.bind(null, item.id);
  const boundDelete = deleteAction.bind(null, item.id);
  const [state, action, pending] = useActionState(boundUpdate, initialState);
  return (
    <div className="grid gap-3 border-t p-3 md:grid-cols-[1fr_auto]">
      <form id={`simple-${item.id}`} action={action} className="contents">
        <Input name="name" defaultValue={item.name} disabled={!canEdit} normalizeUppercase required />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="active" value="false" />
            <input type="checkbox" name="active" value="true" defaultChecked={item.active} disabled={!canEdit} />
            Ativo
          </label>
          {canEdit ? <Button form={`simple-${item.id}`} disabled={pending} className="h-8 px-3">{pending ? "Salvando..." : "Salvar"}</Button> : null}
        </div>
      </form>
      <div className="md:col-span-2">
        <div className="flex items-center justify-between gap-3">
          {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{state.message}</p> : <span />}
          {canDelete ? (
            <form action={boundDelete}>
              <Button type="submit" variant="destructive" className="h-8 px-3" onClick={(event) => { if (!confirm(`Excluir ${label}? Se estiver em uso, será inativado.`)) event.preventDefault(); }}>Excluir</Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SimpleCatalogManager({ items, canEdit, canDelete, updateAction, deleteAction, label, search, page, total, totalPages, pageSize }: CatalogManagerProps<SimpleItem> & { updateAction: (id: string, state: ActionState, formData: FormData) => Promise<ActionState>; deleteAction: (id: string) => Promise<void>; label: string }) {
  return (
    <div className="rounded-lg border bg-background">
      <CatalogListControls search={search} page={page} total={total} totalPages={totalPages} pageSize={pageSize} />
      <div className="grid gap-3 bg-muted p-3 text-sm font-medium md:grid-cols-[1fr_auto]"><span>Nome</span><span className="text-right">Ações</span></div>
      {items.map((item) => <SimpleCatalogRow key={item.id} item={item} canEdit={canEdit} canDelete={canDelete} updateAction={updateAction} deleteAction={deleteAction} label={label} />)}
    </div>
  );
}

export function ContractTypeForm() { return <SimpleCatalogForm action={createContractTypeAction} placeholder="Tipo de contrato" />; }
export function ContractTypeManager(props: CatalogManagerProps<ContractType>) { return <SimpleCatalogManager {...props} updateAction={updateContractTypeAction} deleteAction={deleteContractTypeAction} label="este tipo de contrato" />; }
export function RawMaterialClosingForm() { return <SimpleCatalogForm action={createRawMaterialClosingAction} placeholder="Tipo de MP" />; }
export function RawMaterialClosingManager(props: CatalogManagerProps<RawMaterialClosing>) { return <SimpleCatalogManager {...props} updateAction={updateRawMaterialClosingAction} deleteAction={deleteRawMaterialClosingAction} label="este Tipo de MP" />; }
export function RawMaterialForm() { return <SimpleCatalogForm action={createRawMaterialAction} placeholder="Matéria-prima" />; }
export function RawMaterialManager(props: CatalogManagerProps<RawMaterial>) { return <SimpleCatalogManager {...props} updateAction={updateRawMaterialAction} deleteAction={deleteRawMaterialAction} label="esta matéria-prima" />; }
export function SalesResponsibleForm() { return <SimpleCatalogForm action={createSalesResponsibleAction} placeholder="Responsável pela venda" />; }
export function SalesResponsibleManager(props: CatalogManagerProps<SalesResponsible>) { return <SimpleCatalogManager {...props} updateAction={updateSalesResponsibleAction} deleteAction={deleteSalesResponsibleAction} label="este responsável pela venda" />; }
