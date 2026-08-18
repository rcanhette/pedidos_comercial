"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type { ContractType, Currency, Customer, Order, OrderRawMaterial, Package, Product, RawMaterial, RawMaterialClosing, SalesResponsible } from "@prisma/client";
import { Save } from "lucide-react";
import { createOrderAction, createRawMaterialQuickAction, updateOrderAction, type ActionState } from "@/app/actions";
import { NEW_RECORD_VALUE } from "@/validations/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { calculateTechnicalTonsScaled, centsToDecimal, formatMoneyCents, formatQuantityScaledFixed, moneyInputToCents, quantityInputToScaled, quantityScaledToDecimal, rateScaledToDecimal } from "@/lib/scalars";
import type { CatalogRecentOptionIds } from "@/server/catalog-service";

const initialState: ActionState = { ok: false };

type OrderWithItems = Order & { technicalClosingItems?: OrderRawMaterial[] };
type TechnicalRow = { key: string; rawMaterialId: string; quantityKg: string; price: string };
type MaterialOption = Pick<RawMaterial, "id" | "name" | "active">;
const emptyRecentOptionIds: CatalogRecentOptionIds = { customers: [], products: [], packages: [], currencies: [], contractTypes: [], rawMaterialClosings: [], rawMaterials: [], salesResponsibles: [] };
type OrderFormValues = Record<
  | "contractTypeId"
  | "rawMaterialClosingId"
  | "salesResponsibleId"
  | "newSalesResponsibleName"
  | "customerId"
  | "newCustomerName"
  | "newCustomerCity"
  | "newCustomerCnpj"
  | "productId"
  | "newProductName"
  | "newProductUnit"
  | "newProductDescription"
  | "quantity"
  | "packageId"
  | "currencyId"
  | "unitPrice"
  | "dollarRate"
  | "paymentTerms"
  | "commissionUsd"
  | "paymentDate"
  | "pickupForecast"
  | "freight"
  | "notes",
  string
>;

const formFieldOrder = [
  "contractTypeId",
  "rawMaterialClosingId",
  "salesResponsibleId",
  "newSalesResponsibleName",
  "customerId",
  "newCustomerName",
  "newCustomerCity",
  "newCustomerCnpj",
  "productId",
  "quantity",
  "packageId",
  "newProductName",
  "newProductUnit",
  "newProductDescription",
  "technicalItems",
  "currencyId",
  "unitPrice",
  "dollarRate",
  "paymentTerms",
  "commissionUsd",
  "paymentDate",
  "pickupForecast",
  "freight",
  "notes"
];

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.map((error) => <p key={error} className="mt-1 text-sm text-red-700">{error}</p>) ?? null;
}

function FieldErrorSummary({ fieldErrors }: { fieldErrors?: Record<string, string[]> }) {
  const errors = Object.entries(fieldErrors ?? {}).flatMap(([field, messages]) => messages.map((message) => ({ field, message })));
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
      <p className="font-medium">Corrija os campos destacados antes de salvar.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}
      </ul>
    </div>
  );
}

function decimalValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

function decimalTypingValue(value: string) {
  return value.replace(/[^\d.,]/g, "");
}

function safeQuantityInputToScaled(value: string) {
  try {
    return quantityInputToScaled(value) ?? 0;
  } catch {
    return 0;
  }
}

function safeMoneyInputToCents(value: string) {
  try {
    return moneyInputToCents(value) ?? 0;
  } catch {
    return 0;
  }
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function monthValue(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 7);
}

function rowKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newRow(): TechnicalRow {
  return { key: rowKey(), rawMaterialId: "", quantityKg: "", price: "" };
}

function rowToPayload(row: TechnicalRow) {
  return { rawMaterialId: row.rawMaterialId, quantityKg: row.quantityKg, price: row.price };
}

function initialOrderValues(order?: OrderWithItems): OrderFormValues {
  return {
    contractTypeId: order?.contractTypeId ?? "",
    rawMaterialClosingId: order?.rawMaterialClosingId ?? "",
    salesResponsibleId: order?.salesResponsibleId ?? "",
    newSalesResponsibleName: "",
    customerId: order?.customerId ?? "",
    newCustomerName: "",
    newCustomerCity: "",
    newCustomerCnpj: "",
    productId: order?.productId ?? "",
    newProductName: "",
    newProductUnit: "",
    newProductDescription: "",
    quantity: decimalValue(quantityScaledToDecimal(order?.quantityScaled)),
    packageId: order?.packageId ?? "",
    currencyId: order?.currencyId ?? "",
    unitPrice: decimalValue(centsToDecimal(order?.unitPriceCents)),
    dollarRate: order?.dollarRateText ?? decimalValue(rateScaledToDecimal(order?.dollarRateScaled)),
    paymentTerms: order?.paymentTerms ?? "",
    commissionUsd: decimalValue(centsToDecimal(order?.commissionUsdCents)),
    paymentDate: dateValue(order?.paymentDate),
    pickupForecast: monthValue(order?.pickupForecast),
    freight: order?.freightText ?? decimalValue(centsToDecimal(order?.freightCents)),
    notes: order?.notes ?? ""
  };
}

function pickOrderValues(values?: Record<string, string>) {
  if (!values) return {};
  return Object.fromEntries(Object.keys(initialOrderValues()).flatMap((key) => key in values ? [[key, values[key]]] : [])) as Partial<OrderFormValues>;
}

function parseTechnicalRows(value?: string): TechnicalRow[] | null {
  if (!value) return null;
  try {
    const rows = JSON.parse(value) as Array<{ rawMaterialId?: string; quantityKg?: string; price?: string }>;
    return rows.length > 0 ? rows.map((row) => ({ key: rowKey(), rawMaterialId: row.rawMaterialId ?? "", quantityKg: row.quantityKg ?? "", price: row.price ?? "" })) : [newRow()];
  } catch {
    return null;
  }
}

function firstErrorField(fieldErrors?: Record<string, string[]>) {
  const fields = Object.keys(fieldErrors ?? {});
  if (fields.length === 0) return null;
  const ordered = formFieldOrder.find((field) => fields.some((errorField) => errorField === field || errorField.startsWith(`${field}.`)));
  return ordered ? fields.find((field) => field === ordered || field.startsWith(`${ordered}.`)) ?? ordered : fields[0];
}

function errorClass(errors?: string[]) {
  return errors?.length ? "border-red-500 focus:ring-red-500" : undefined;
}

function technicalError(fieldErrors: ActionState["fieldErrors"], index: number, field: keyof TechnicalRow) {
  return fieldErrors?.[`technicalItems.${index}.${field}`];
}

function generalTechnicalErrors(fieldErrors: ActionState["fieldErrors"]) {
  return fieldErrors?.technicalItems;
}

function focusField(field: string) {
  const escaped = field.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  const target = document.querySelector<HTMLElement>(`[data-field-error="${escaped}"]`) ?? document.querySelector<HTMLElement>(`[data-field-error="${field.split(".")[0]}"]`);
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
  const focusTarget = target?.matches("input,select,textarea,button") ? target : target?.querySelector<HTMLElement>("input,select,textarea,button");
  focusTarget?.focus({ preventScroll: true });
}

function customerOption(customer: Pick<Customer, "id" | "name" | "city" | "cnpj" | "active">): SearchableSelectOption {
  return { id: customer.id, label: `${customer.name} - ${customer.city}`, searchText: `${customer.name} ${customer.city} ${customer.cnpj}`, active: customer.active };
}

function namedOption(item: { id: string; name: string; active: boolean }): SearchableSelectOption {
  return { id: item.id, label: item.name, active: item.active };
}

function currencyOption(currency: Pick<Currency, "id" | "code" | "symbol" | "active">): SearchableSelectOption {
  return { id: currency.id, label: `${currency.code} - ${currency.symbol}`, searchText: `${currency.code} ${currency.symbol}`, active: currency.active };
}

export function OrderForm({
  customers,
  products,
  packages,
  currencies,
  contractTypes,
  rawMaterialClosings,
  salesResponsibles,
  rawMaterials,
  recentOptionIds = emptyRecentOptionIds,
  canCreateRawMaterial,
  canEditTechnicalList,
  order
}: {
  customers: Customer[];
  products: Product[];
  packages: Package[];
  currencies: Currency[];
  contractTypes: ContractType[];
  rawMaterialClosings: RawMaterialClosing[];
  salesResponsibles: SalesResponsible[];
  rawMaterials: RawMaterial[];
  recentOptionIds?: CatalogRecentOptionIds;
  canCreateRawMaterial: boolean;
  canEditTechnicalList: boolean;
  order?: OrderWithItems;
}) {
  const formAction = order ? updateOrderAction.bind(null, order.id) : createOrderAction;
  const [state, action, pending] = useActionState(formAction, initialState);
  const [isCreatingMaterial, startCreateMaterial] = useTransition();
  const [formValues, setFormValues] = useState<OrderFormValues>(() => initialOrderValues(order));
  const [materials, setMaterials] = useState<MaterialOption[]>(rawMaterials);
  const [quickRowKey, setQuickRowKey] = useState<string | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [technicalRows, setTechnicalRows] = useState<TechnicalRow[]>(() => {
    const items = order?.technicalClosingItems ?? [];
    return items.length > 0
      ? items.map((item) => ({ key: item.id, rawMaterialId: item.rawMaterialId, quantityKg: decimalValue(quantityScaledToDecimal(item.quantityKgScaled)), price: decimalValue(centsToDecimal(item.priceCents)) }))
      : [newRow()];
  });
  const isNewCustomer = formValues.customerId === NEW_RECORD_VALUE;
  const isNewProduct = formValues.productId === NEW_RECORD_VALUE;
  const isNewSalesResponsible = formValues.salesResponsibleId === NEW_RECORD_VALUE;
  const orderQuantityScaled = safeQuantityInputToScaled(formValues.quantity);
  const customerOptions = useMemo(() => customers.map(customerOption), [customers]);
  const productOptions = useMemo(() => products.map(namedOption), [products]);
  const packageOptions = useMemo(() => packages.map(namedOption), [packages]);
  const currencyOptions = useMemo(() => currencies.map(currencyOption), [currencies]);
  const contractTypeOptions = useMemo(() => contractTypes.map(namedOption), [contractTypes]);
  const rawMaterialClosingOptions = useMemo(() => rawMaterialClosings.map(namedOption), [rawMaterialClosings]);
  const salesResponsibleOptions = useMemo(() => salesResponsibles.map(namedOption), [salesResponsibles]);
  const materialOptions = useMemo(() => materials.map(namedOption), [materials]);
  const totals = useMemo(() => {
    return technicalRows.reduce(
      (acc, row) => {
        const kg = safeQuantityInputToScaled(row.quantityKg);
        const tons = kg > 0 && orderQuantityScaled > 0 ? calculateTechnicalTonsScaled(kg, orderQuantityScaled) : 0;
        const price = safeMoneyInputToCents(row.price);
        return { kg: acc.kg + kg, tons: acc.tons + tons, price: acc.price + price };
      },
      { kg: 0, tons: 0, price: 0 }
    );
  }, [technicalRows, orderQuantityScaled]);

  useEffect(() => {
    if (!state.values) return;
    setFormValues((current) => ({ ...current, ...pickOrderValues(state.values) }));
    const submittedRows = parseTechnicalRows(state.values.technicalItems);
    if (submittedRows) setTechnicalRows(submittedRows);
  }, [state.values]);

  useEffect(() => {
    const field = firstErrorField(state.fieldErrors);
    if (!field) return;
    requestAnimationFrame(() => focusField(field));
  }, [state.fieldErrors]);

  function setValue(name: keyof OrderFormValues, value: string) {
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function setRow(key: string, patch: Partial<TechnicalRow>) {
    setTechnicalRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleMaterialSelection(row: TechnicalRow, value: string) {
    if (value === NEW_RECORD_VALUE) {
      setQuickRowKey(row.key);
      setQuickName("");
      setQuickError(null);
      return;
    }
    if (value && technicalRows.some((item) => item.key !== row.key && item.rawMaterialId === value)) {
      setRow(row.key, { rawMaterialId: "" });
      setQuickError("Não repita a mesma matéria-prima no pedido.");
      return;
    }
    setQuickError(null);
    setRow(row.key, { rawMaterialId: value });
  }

  function createQuickMaterial() {
    startCreateMaterial(async () => {
      setQuickError(null);
      const result = await createRawMaterialQuickAction(quickName);
      if (!result.ok || !result.item) {
        setQuickError(result.message ?? "Erro ao salvar matéria-prima.");
        return;
      }
      setMaterials((current) => [...current, result.item].sort((a, b) => a.name.localeCompare(b.name)));
      if (quickRowKey) setRow(quickRowKey, { rawMaterialId: result.item.id });
      setQuickRowKey(null);
    });
  }

  return (
    <form action={action} className="space-y-6">
      {state.message ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.message}</p> : null}
      <FieldErrorSummary fieldErrors={state.fieldErrors} />
      {quickError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{quickError}</p> : null}
      {canEditTechnicalList ? <input type="hidden" name="technicalItems" value={JSON.stringify(technicalRows.map(rowToPayload).filter((item) => item.rawMaterialId || item.quantityKg || item.price))} /> : null}

      <section className="rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-semibold">1. Definir Nome</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">Tipo de Contrato
            <SearchableSelect name="contractTypeId" value={formValues.contractTypeId} onChange={(value) => setValue("contractTypeId", value)} options={contractTypeOptions} recentIds={recentOptionIds.contractTypes} placeholder="Digite o tipo de contrato" fieldError="contractTypeId" error={Boolean(state.fieldErrors?.contractTypeId)} required />
            <FieldError errors={state.fieldErrors?.contractTypeId} />
          </label>
          <label className="text-sm font-medium">Tipo de MP
            <SearchableSelect name="rawMaterialClosingId" value={formValues.rawMaterialClosingId} onChange={(value) => setValue("rawMaterialClosingId", value)} options={rawMaterialClosingOptions} recentIds={recentOptionIds.rawMaterialClosings} placeholder="Digite o tipo de MP" fieldError="rawMaterialClosingId" error={Boolean(state.fieldErrors?.rawMaterialClosingId)} required />
            <FieldError errors={state.fieldErrors?.rawMaterialClosingId} />
          </label>
          <label className="text-sm font-medium">Responsável pela venda
            <SearchableSelect name="salesResponsibleId" value={formValues.salesResponsibleId} onChange={(value) => setValue("salesResponsibleId", value)} options={salesResponsibleOptions} recentIds={recentOptionIds.salesResponsibles} placeholder="Digite o responsável" newOption={{ value: NEW_RECORD_VALUE, label: "Novo responsável" }} fieldError="salesResponsibleId" error={Boolean(state.fieldErrors?.salesResponsibleId)} />
            <FieldError errors={state.fieldErrors?.salesResponsibleId} />
          </label>
          {isNewSalesResponsible ? <div className="rounded-md border bg-muted/30 p-4 md:col-span-3"><label className="text-sm font-medium">Nome<Input name="newSalesResponsibleName" data-field-error="newSalesResponsibleName" className={errorClass(state.fieldErrors?.newSalesResponsibleName)} value={formValues.newSalesResponsibleName} onChange={(event) => setValue("newSalesResponsibleName", event.target.value)} normalizeUppercase required={isNewSalesResponsible} /><FieldError errors={state.fieldErrors?.newSalesResponsibleName} /></label></div> : null}
        </div>
      </section>

      <section className="rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-semibold">2. Dados do Cliente</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium md:col-span-2">Cliente
            <SearchableSelect name="customerId" value={formValues.customerId} onChange={(value) => setValue("customerId", value)} options={customerOptions} recentIds={recentOptionIds.customers} placeholder="Digite cliente, cidade ou CNPJ" newOption={{ value: NEW_RECORD_VALUE, label: "Novo cliente" }} fieldError="customerId" error={Boolean(state.fieldErrors?.customerId)} required />
            <FieldError errors={state.fieldErrors?.customerId} />
          </label>
          {order && !isNewCustomer ? <div className="rounded-md border bg-muted/40 p-3 text-sm"><p className="font-medium">Dados gravados no pedido</p><p className="text-muted-foreground">{order.customerName} - {order.city}</p><p className="text-muted-foreground">{order.cnpj}</p></div> : null}
          {isNewCustomer ? <div className="grid gap-4 rounded-md border bg-muted/30 p-4 md:col-span-3 md:grid-cols-3"><label className="text-sm font-medium">Cliente<Input name="newCustomerName" data-field-error="newCustomerName" className={errorClass(state.fieldErrors?.newCustomerName)} value={formValues.newCustomerName} onChange={(event) => setValue("newCustomerName", event.target.value)} normalizeUppercase required={isNewCustomer} /><FieldError errors={state.fieldErrors?.newCustomerName} /></label><label className="text-sm font-medium">Cidade<Input name="newCustomerCity" data-field-error="newCustomerCity" className={errorClass(state.fieldErrors?.newCustomerCity)} value={formValues.newCustomerCity} onChange={(event) => setValue("newCustomerCity", event.target.value)} normalizeUppercase required={isNewCustomer} /><FieldError errors={state.fieldErrors?.newCustomerCity} /></label><label className="text-sm font-medium">CNPJ<Input name="newCustomerCnpj" data-field-error="newCustomerCnpj" className={errorClass(state.fieldErrors?.newCustomerCnpj)} placeholder="00.000.000/0000-00" value={formValues.newCustomerCnpj} onChange={(event) => setValue("newCustomerCnpj", event.target.value)} required={isNewCustomer} /><FieldError errors={state.fieldErrors?.newCustomerCnpj} /></label></div> : null}
        </div>
      </section>

      <section className="rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-semibold">3. Dados do produto</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">Produto
            <SearchableSelect name="productId" value={formValues.productId} onChange={(value) => setValue("productId", value)} options={productOptions} recentIds={recentOptionIds.products} placeholder="Digite o produto" newOption={{ value: NEW_RECORD_VALUE, label: "Novo produto" }} fieldError="productId" error={Boolean(state.fieldErrors?.productId)} required />
            <FieldError errors={state.fieldErrors?.productId} />
          </label>
          <label className="text-sm font-medium">Quantidade<Input name="quantity" data-field-error="quantity" className={errorClass(state.fieldErrors?.quantity)} inputMode="decimal" placeholder="0,00" value={formValues.quantity} onChange={(event) => setValue("quantity", decimalTypingValue(event.target.value))} required /><FieldError errors={state.fieldErrors?.quantity} /></label>
          <label className="text-sm font-medium">Embalagem
            <SearchableSelect name="packageId" value={formValues.packageId} onChange={(value) => setValue("packageId", value)} options={packageOptions} recentIds={recentOptionIds.packages} placeholder="Digite a embalagem" fieldError="packageId" error={Boolean(state.fieldErrors?.packageId)} required />
            <FieldError errors={state.fieldErrors?.packageId} />
          </label>
          {isNewProduct ? <div className="grid gap-4 rounded-md border bg-muted/30 p-4 md:col-span-3 md:grid-cols-3"><label className="text-sm font-medium">Produto<Input name="newProductName" data-field-error="newProductName" className={errorClass(state.fieldErrors?.newProductName)} value={formValues.newProductName} onChange={(event) => setValue("newProductName", event.target.value)} normalizeUppercase required={isNewProduct} /><FieldError errors={state.fieldErrors?.newProductName} /></label><label className="text-sm font-medium">Unidade<Input name="newProductUnit" data-field-error="newProductUnit" className={errorClass(state.fieldErrors?.newProductUnit)} value={formValues.newProductUnit} onChange={(event) => setValue("newProductUnit", event.target.value)} normalizeUppercase required={isNewProduct} /><FieldError errors={state.fieldErrors?.newProductUnit} /></label><label className="text-sm font-medium">Descrição<Input name="newProductDescription" data-field-error="newProductDescription" className={errorClass(state.fieldErrors?.newProductDescription)} value={formValues.newProductDescription} onChange={(event) => setValue("newProductDescription", event.target.value)} normalizeUppercase /><FieldError errors={state.fieldErrors?.newProductDescription} /></label></div> : null}
        </div>

        {canEditTechnicalList ? <div id="lista-tecnica" className="mt-6 space-y-3" data-field-error="technicalItems">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Lista Técnica</h3><p className="text-sm text-muted-foreground">A quantidade em TONS é calculada automaticamente com base na quantidade do pedido.</p></div><Button type="button" variant="outline" onClick={() => setTechnicalRows((rows) => [...rows, newRow()])}>Adicionar matéria-prima</Button></div>
          <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[860px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Matéria-prima</th><th className="p-3">Quantidade em KG</th><th className="p-3">Quantidade em TONS</th><th className="p-3">Preço</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>{technicalRows.map((row, index) => { const kg = safeQuantityInputToScaled(row.quantityKg); const tons = kg > 0 && orderQuantityScaled > 0 ? calculateTechnicalTonsScaled(kg, orderQuantityScaled) : 0; const materialErrors = technicalError(state.fieldErrors, index, "rawMaterialId"); const quantityErrors = technicalError(state.fieldErrors, index, "quantityKg"); const priceErrors = technicalError(state.fieldErrors, index, "price"); const selectedMaterialIds = technicalRows.filter((item) => item.key !== row.key).map((item) => item.rawMaterialId); return <tr key={row.key} className="border-t align-top"><td className="w-[360px] p-3"><SearchableSelect value={row.rawMaterialId} onChange={(value) => handleMaterialSelection(row, value)} options={materialOptions} recentIds={recentOptionIds.rawMaterials} placeholder="Digite a matéria-prima" newOption={canCreateRawMaterial ? { value: NEW_RECORD_VALUE, label: "Nova matéria-prima" } : undefined} fieldError={`technicalItems.${index}.rawMaterialId`} error={Boolean(materialErrors)} disabledValues={selectedMaterialIds} required /><FieldError errors={materialErrors} /></td><td className="p-3"><Input data-field-error={`technicalItems.${index}.quantityKg`} className={errorClass(quantityErrors)} inputMode="decimal" placeholder="0,000" value={row.quantityKg} onChange={(event) => setRow(row.key, { quantityKg: decimalTypingValue(event.target.value) })} required /><FieldError errors={quantityErrors} /></td><td className="p-3"><Input readOnly value={formatQuantityScaledFixed(tons)} /></td><td className="p-3"><Input data-field-error={`technicalItems.${index}.price`} className={errorClass(priceErrors)} inputMode="decimal" placeholder="0,00" value={row.price} onChange={(event) => setRow(row.key, { price: decimalTypingValue(event.target.value) })} required /><FieldError errors={priceErrors} /></td><td className="p-3 text-right"><Button type="button" variant="outline" className="h-8 px-3" onClick={() => setTechnicalRows((rows) => rows.length === 1 ? [newRow()] : rows.filter((item) => item.key !== row.key))}>Remover</Button></td></tr>; })}<tr className="border-t bg-muted/40 font-semibold"><td className="p-3">TOTAL</td><td className="p-3">{formatQuantityScaledFixed(totals.kg)}</td><td className="p-3">{formatQuantityScaledFixed(totals.tons)}</td><td className="p-3">{formatMoneyCents(totals.price)}</td><td /></tr></tbody></table></div>
          <FieldError errors={generalTechnicalErrors(state.fieldErrors)} />
        </div> : null}
      </section>

      <section className="rounded-lg border bg-background p-5"><h2 className="mb-4 text-lg font-semibold">4. Valores e condições</h2><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Moeda<SearchableSelect name="currencyId" value={formValues.currencyId} onChange={(value) => setValue("currencyId", value)} options={currencyOptions} recentIds={recentOptionIds.currencies} placeholder="Digite a moeda" fieldError="currencyId" error={Boolean(state.fieldErrors?.currencyId)} required /><FieldError errors={state.fieldErrors?.currencyId} /></label><label className="text-sm font-medium">Valor unitário<Input name="unitPrice" data-field-error="unitPrice" className={errorClass(state.fieldErrors?.unitPrice)} inputMode="decimal" placeholder="0,00" value={formValues.unitPrice} onChange={(event) => setValue("unitPrice", decimalTypingValue(event.target.value))} required /><FieldError errors={state.fieldErrors?.unitPrice} /></label><label className="text-sm font-medium">Cotação do dólar<Input name="dollarRate" data-field-error="dollarRate" className={errorClass(state.fieldErrors?.dollarRate)} placeholder="5,0000 ou texto" value={formValues.dollarRate} onChange={(event) => setValue("dollarRate", event.target.value)} normalizeUppercase /><FieldError errors={state.fieldErrors?.dollarRate} /></label><label className="text-sm font-medium md:col-span-2">Condição de pagamento<Input name="paymentTerms" data-field-error="paymentTerms" className={errorClass(state.fieldErrors?.paymentTerms)} value={formValues.paymentTerms} onChange={(event) => setValue("paymentTerms", event.target.value)} normalizeUppercase required /><FieldError errors={state.fieldErrors?.paymentTerms} /></label><label className="text-sm font-medium">Comissão em USD<Input name="commissionUsd" data-field-error="commissionUsd" className={errorClass(state.fieldErrors?.commissionUsd)} inputMode="decimal" placeholder="0,00" value={formValues.commissionUsd} onChange={(event) => setValue("commissionUsd", decimalTypingValue(event.target.value))} /><FieldError errors={state.fieldErrors?.commissionUsd} /></label></div></section>
      <section className="rounded-lg border bg-background p-5"><h2 className="mb-4 text-lg font-semibold">5. Datas e logística</h2><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Data de pagamento<Input name="paymentDate" data-field-error="paymentDate" className={errorClass(state.fieldErrors?.paymentDate)} type="date" value={formValues.paymentDate} onChange={(event) => setValue("paymentDate", event.target.value)} /><FieldError errors={state.fieldErrors?.paymentDate} /></label><label className="text-sm font-medium">Previsão de retirada<Input name="pickupForecast" data-field-error="pickupForecast" className={errorClass(state.fieldErrors?.pickupForecast)} type="month" value={formValues.pickupForecast} onChange={(event) => setValue("pickupForecast", event.target.value)} required /><FieldError errors={state.fieldErrors?.pickupForecast} /></label><label className="text-sm font-medium">Frete<Input name="freight" data-field-error="freight" className={errorClass(state.fieldErrors?.freight)} placeholder="CIF, FOB, A combinar" value={formValues.freight} onChange={(event) => setValue("freight", event.target.value)} normalizeUppercase /><FieldError errors={state.fieldErrors?.freight} /></label></div></section>
      <section className="rounded-lg border bg-background p-5"><h2 className="mb-4 text-lg font-semibold">6. Observações</h2><Textarea name="notes" data-field-error="notes" className={errorClass(state.fieldErrors?.notes)} maxLength={2000} value={formValues.notes} onChange={(event) => setValue("notes", event.target.value)} normalizeUppercase /><FieldError errors={state.fieldErrors?.notes} /></section>
      <section className="rounded-lg border bg-background p-5"><h2 className="mb-2 text-lg font-semibold">7. Resumo do pedido</h2><p className="text-sm text-muted-foreground">{order ? "As alterações serão registradas no histórico do pedido." : "O representante, a data da solicitação, o número e o status Recebido serão gerados automaticamente ao salvar."}</p></section>
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => history.back()}>Cancelar</Button><Button disabled={pending || isCreatingMaterial}><Save size={18} />{pending ? "Salvando..." : order ? "Atualizar pedido" : "Salvar pedido"}</Button></div>

      {canEditTechnicalList && quickRowKey ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-lg"><h3 className="text-lg font-semibold">Nova matéria-prima</h3><label className="mt-4 block text-sm font-medium">Nome<Input value={quickName} onChange={(event) => setQuickName(event.target.value)} normalizeUppercase autoFocus /></label><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setQuickRowKey(null)}>Cancelar</Button><Button type="button" disabled={isCreatingMaterial} onClick={createQuickMaterial}>{isCreatingMaterial ? "Salvando..." : "Salvar"}</Button></div></div></div> : null}
    </form>
  );
}
