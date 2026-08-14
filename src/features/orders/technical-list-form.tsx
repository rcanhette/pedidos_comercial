"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type { Order, OrderRawMaterial, RawMaterial } from "@prisma/client";
import { Save } from "lucide-react";
import { createRawMaterialQuickAction, updateTechnicalListAction, type ActionState } from "@/app/actions";
import { NEW_RECORD_VALUE } from "@/validations/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { calculateTechnicalTonsScaled, centsToDecimal, formatMoneyCents, formatQuantityScaledFixed, moneyInputToCents, quantityScaledToDecimal, quantityInputToScaled } from "@/lib/scalars";

const initialState: ActionState = { ok: false };
type TechnicalOrder = Pick<Order, "id" | "quantityScaled" | "currencyCodeSnapshot"> & { technicalClosingItems?: OrderRawMaterial[] };
type TechnicalRow = { key: string; rawMaterialId: string; quantityKg: string; price: string };
type MaterialOption = Pick<RawMaterial, "id" | "name" | "active">;

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

function parseTechnicalRows(value?: string): TechnicalRow[] | null {
  if (!value) return null;
  try {
    const rows = JSON.parse(value) as Array<{ rawMaterialId?: string; quantityKg?: string; price?: string }>;
    return rows.length > 0 ? rows.map((row) => ({ key: rowKey(), rawMaterialId: row.rawMaterialId ?? "", quantityKg: row.quantityKg ?? "", price: row.price ?? "" })) : [newRow()];
  } catch {
    return null;
  }
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.map((error) => <p key={error} className="mt-1 text-sm text-red-700">{error}</p>) ?? null;
}

function errorClass(errors?: string[]) {
  return errors?.length ? "border-red-500 focus:ring-red-500" : undefined;
}

function technicalError(fieldErrors: ActionState["fieldErrors"], index: number, field: keyof TechnicalRow) {
  return fieldErrors?.[`technicalItems.${index}.${field}`];
}

function firstTechnicalError(fieldErrors?: Record<string, string[]>) {
  const fields = Object.keys(fieldErrors ?? {});
  return fields.find((field) => field.startsWith("technicalItems.")) ?? fields[0] ?? null;
}

function focusField(field: string) {
  const escaped = field.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  const target = document.querySelector<HTMLElement>(`[data-field-error="${escaped}"]`) ?? document.querySelector<HTMLElement>('[data-field-error="technicalItems"]');
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
  const focusTarget = target?.matches("input,select,textarea,button") ? target : target?.querySelector<HTMLElement>("input,select,textarea,button");
  focusTarget?.focus({ preventScroll: true });
}

export function TechnicalListForm({ order, rawMaterials, canCreateRawMaterial }: { order: TechnicalOrder; rawMaterials: RawMaterial[]; canCreateRawMaterial: boolean }) {
  const formAction = updateTechnicalListAction.bind(null, order.id);
  const [state, action, pending] = useActionState(formAction, initialState);
  const [isCreatingMaterial, startCreateMaterial] = useTransition();
  const [materials, setMaterials] = useState<MaterialOption[]>(rawMaterials);
  const [quickRowKey, setQuickRowKey] = useState<string | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [technicalRows, setTechnicalRows] = useState<TechnicalRow[]>(() => {
    const items = order.technicalClosingItems ?? [];
    return items.length > 0
      ? items.map((item) => ({ key: item.id, rawMaterialId: item.rawMaterialId, quantityKg: decimalValue(quantityScaledToDecimal(item.quantityKgScaled)), price: decimalValue(centsToDecimal(item.priceCents)) }))
      : [newRow()];
  });

  const totals = useMemo(() => {
    return technicalRows.reduce(
      (acc, row) => {
        const kg = safeQuantityInputToScaled(row.quantityKg);
        const tons = kg > 0 && order.quantityScaled > 0 ? calculateTechnicalTonsScaled(kg, order.quantityScaled) : 0;
        const price = safeMoneyInputToCents(row.price);
        return { kg: acc.kg + kg, tons: acc.tons + tons, price: acc.price + price };
      },
      { kg: 0, tons: 0, price: 0 }
    );
  }, [technicalRows, order.quantityScaled]);

  useEffect(() => {
    const submittedRows = parseTechnicalRows(state.values?.technicalItems);
    if (submittedRows) setTechnicalRows(submittedRows);
  }, [state.values]);

  useEffect(() => {
    const field = firstTechnicalError(state.fieldErrors);
    if (!field) return;
    requestAnimationFrame(() => focusField(field));
  }, [state.fieldErrors]);

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
    <form action={action} className="space-y-4">
      {state.message ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.message}</p> : null}
      {quickError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{quickError}</p> : null}
      <input type="hidden" name="technicalItems" value={JSON.stringify(technicalRows.map(rowToPayload).filter((item) => item.rawMaterialId || item.quantityKg || item.price))} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lista Técnica</h2>
          <p className="text-sm text-muted-foreground">A quantidade em TONS é calculada automaticamente com base na quantidade do pedido.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setTechnicalRows((rows) => [...rows, newRow()])}>Adicionar matéria-prima</Button>
      </div>
      <div className="overflow-x-auto rounded-md border" data-field-error="technicalItems"><table className="w-full min-w-[860px] text-sm"><thead className="bg-muted text-left"><tr><th className="p-3">Matéria-prima</th><th className="p-3">Quantidade em KG</th><th className="p-3">Quantidade em TONS</th><th className="p-3">Preço</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>{technicalRows.map((row, index) => { const kg = safeQuantityInputToScaled(row.quantityKg); const tons = kg > 0 && order.quantityScaled > 0 ? calculateTechnicalTonsScaled(kg, order.quantityScaled) : 0; const materialErrors = technicalError(state.fieldErrors, index, "rawMaterialId"); const quantityErrors = technicalError(state.fieldErrors, index, "quantityKg"); const priceErrors = technicalError(state.fieldErrors, index, "price"); return <tr key={row.key} className="border-t"><td className="p-3"><select data-field-error={`technicalItems.${index}.rawMaterialId`} className={cn("h-10 w-full rounded-md border px-3", errorClass(materialErrors))} value={row.rawMaterialId} onChange={(event) => handleMaterialSelection(row, event.target.value)} required><option value="">Selecione</option>{canCreateRawMaterial ? <option value={NEW_RECORD_VALUE}>+ Nova matéria-prima</option> : null}{materials.map((material) => <option key={material.id} value={material.id}>{material.name}{material.active ? "" : " (inativa)"}</option>)}</select><FieldError errors={materialErrors} /></td><td className="p-3"><Input data-field-error={`technicalItems.${index}.quantityKg`} className={errorClass(quantityErrors)} inputMode="decimal" placeholder="0,000" value={row.quantityKg} onChange={(event) => setRow(row.key, { quantityKg: decimalTypingValue(event.target.value) })} required /><FieldError errors={quantityErrors} /></td><td className="p-3"><Input readOnly value={formatQuantityScaledFixed(tons)} /></td><td className="p-3"><Input data-field-error={`technicalItems.${index}.price`} className={errorClass(priceErrors)} inputMode="decimal" placeholder="0,00" value={row.price} onChange={(event) => setRow(row.key, { price: decimalTypingValue(event.target.value) })} required /><FieldError errors={priceErrors} /></td><td className="p-3 text-right"><Button type="button" variant="outline" className="h-8 px-3" onClick={() => setTechnicalRows((rows) => rows.length === 1 ? [newRow()] : rows.filter((item) => item.key !== row.key))}>Remover</Button></td></tr>; })}<tr className="border-t bg-muted/40 font-semibold"><td className="p-3">TOTAL</td><td className="p-3">{formatQuantityScaledFixed(totals.kg)}</td><td className="p-3">{formatQuantityScaledFixed(totals.tons)}</td><td className="p-3">{formatMoneyCents(totals.price, order.currencyCodeSnapshot)}</td><td /></tr></tbody></table></div>
      <FieldError errors={state.fieldErrors?.technicalItems} />
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => history.back()}>Cancelar</Button><Button disabled={pending || isCreatingMaterial}><Save size={18} />{pending ? "Salvando..." : "Salvar Lista Técnica"}</Button></div>
      {quickRowKey ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-lg border bg-background p-5 shadow-lg"><h3 className="text-lg font-semibold">Nova matéria-prima</h3><label className="mt-4 block text-sm font-medium">Nome<Input value={quickName} onChange={(event) => setQuickName(event.target.value)} normalizeUppercase autoFocus /></label><div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setQuickRowKey(null)}>Cancelar</Button><Button type="button" disabled={isCreatingMaterial} onClick={createQuickMaterial}>{isCreatingMaterial ? "Salvando..." : "Salvar"}</Button></div></div></div> : null}
    </form>
  );
}
