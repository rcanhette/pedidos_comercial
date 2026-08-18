"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loginCodeSchema, loginSchema } from "@/validations/user";
import { formatZodFieldErrors, orderCreateSchema, orderStatusSchema, technicalListUpdateSchema } from "@/validations/order";
import { normalizeFreeText } from "@/validations/common";
import { login, destroySession, requireUser, verifyLoginChallenge } from "@/server/auth";
import { createOrder, changeOrderStatus, recordLogout, updateOrder, updateOrderTechnicalList } from "@/server/order-service";
import { createContractType, createCurrency, createCustomer, createPackage, createProduct, createRawMaterial, createRawMaterialClosing, createRawMaterialQuick, createSalesResponsible, deleteContractType, deleteCurrency, deleteCustomer, deletePackage, deleteProduct, deleteRawMaterial, deleteRawMaterialClosing, deleteSalesResponsible, updateContractType, updateCurrency, updateCustomer, updatePackage, updateProduct, updateRawMaterial, updateRawMaterialClosing, updateSalesResponsible } from "@/server/catalog-service";
import { bulkImportConfig, importBulkWorkbook, parseBulkImportKind, validateBulkImportWorkbook, type BulkImportValidationResult } from "@/server/bulk-import-service";
import { createUser, deleteUser, updateOwnProfile, updateUser } from "@/server/user-service";

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string> };
export type BulkImportActionState = {
  ok: boolean;
  phase?: "validated" | "imported";
  message?: string;
  selectedKind?: string;
  validation?: BulkImportValidationResult;
  imported?: { kind: string; label: string; count: number; analyzed: number; skippedExisting: number; skippedDuplicated: number };
};

const uppercaseValueFields = new Set([
  "newCustomerName",
  "newCustomerCity",
  "newSalesResponsibleName",
  "newProductName",
  "newProductUnit",
  "newProductDescription",
  "dollarRate",
  "paymentTerms",
  "freight",
  "notes",
  "justification"
]);

function parseFormData(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, typeof value === "string" && value === "" ? undefined : value])
  );
}

function formDataValues(formData: FormData): Record<string, string> {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => {
    if (typeof value !== "string") return [key, value.name];
    return [key, uppercaseValueFields.has(key) ? normalizeFreeText(value) : value];
  }));
}

function orderServiceFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (!(error instanceof Error)) return undefined;
  const message = error.message;
  const mappings: Array<[string, string]> = [
    ["Cliente ativo não encontrado.", "customerId"],
    ["Informe os dados do novo cliente.", "newCustomerName"],
    ["Produto ativo não encontrado.", "productId"],
    ["Informe os dados do novo produto.", "newProductName"],
    ["Tipo de contrato ativo não encontrado.", "contractTypeId"],
    ["Tipo de MP ativo não encontrado.", "rawMaterialClosingId"],
    ["Responsável pela venda ativo não encontrado.", "salesResponsibleId"],
    ["Embalagem ativa não encontrada.", "packageId"],
    ["Embalagem não encontrada.", "packageId"],
    ["Moeda ativa não encontrada.", "currencyId"],
    ["Moeda não encontrada.", "currencyId"],
    ["A quantidade do pedido deve ser maior que zero.", "quantity"],
    ["Informe pelo menos uma matéria-prima.", "technicalItems"],
    ["Não repita a mesma matéria-prima no pedido.", "technicalItems"],
    ["Matéria-prima ativa não encontrada.", "technicalItems"],
    ["A quantidade em KG deve ser maior que zero.", "technicalItems"],
    ["Informe o preço.", "technicalItems"],
    ["O preço da matéria-prima não pode ser negativo.", "technicalItems"]
  ];
  const field = mappings.find(([knownMessage]) => knownMessage === message)?.[1];
  return field ? { [field]: [message] } : undefined;
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const result = await login(parsed.data.identifier, parsed.data.password);
  if (!result.ok) return { ok: false, message: result.message };
  if ("bypassedTwoFactor" in result && result.bypassedTwoFactor) redirect("/dashboard");
  redirect("/login/verify");
}

export async function verifyLoginCodeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const result = await verifyLoginChallenge(parsed.data.code);
  if (!result.ok) return { ok: false, message: result.message };
  redirect("/dashboard");
}

export async function logoutAction() {
  const user = await requireUser();
  await recordLogout(user);
  await destroySession();
  redirect("/login");
}

export async function createOrderAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formDataValues(formData);
  const parsed = orderCreateSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, fieldErrors: formatZodFieldErrors(parsed.error), values };
  let orderId: string;
  try {
    const order = await createOrder(user, parsed.data);
    orderId = order.id;
    revalidatePath("/orders");
  } catch (error) {
    return { ok: false, fieldErrors: orderServiceFieldErrors(error), message: error instanceof Error ? error.message : "Não foi possível salvar o pedido.", values };
  }
  redirect(`/orders/${orderId}?created=1`);
}

export async function updateOrderAction(orderId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formDataValues(formData);
  const parsed = orderCreateSchema.safeParse(parseFormData(formData));
  if (!parsed.success) return { ok: false, fieldErrors: formatZodFieldErrors(parsed.error), values };
  try {
    await updateOrder(user, orderId, parsed.data, { updateTechnicalList: formData.has("technicalItems") });
  } catch (error) {
    return { ok: false, fieldErrors: orderServiceFieldErrors(error), message: error instanceof Error ? error.message : "Não foi possível atualizar o pedido.", values };
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders/my");
  revalidatePath("/orders/all");
  redirect(`/orders/${orderId}`);
}

export async function updateTechnicalListAction(orderId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = formDataValues(formData);
  const parsed = technicalListUpdateSchema.safeParse({ technicalItems: formData.get("technicalItems") });
  if (!parsed.success) return { ok: false, fieldErrors: formatZodFieldErrors(parsed.error), values };
  try {
    await updateOrderTechnicalList(user, orderId, parsed.data);
  } catch (error) {
    return { ok: false, fieldErrors: orderServiceFieldErrors(error), message: error instanceof Error ? error.message : "Não foi possível salvar a Lista Técnica.", values };
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/technical-list`);
  revalidatePath("/orders/my");
  revalidatePath("/orders/all");
  redirect(`/orders/${orderId}`);
}

export async function changeStatusAction(orderId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = orderStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await changeOrderStatus(user, orderId, parsed.data);
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, message: "Status atualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível alterar o status." };
  }
}

export async function createCustomerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await createCustomer(user, formData);
    revalidatePath("/customers");
    return { ok: true, message: "Cliente salvo." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar cliente." };
  }
}

export async function updateCustomerAction(customerId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateCustomer(user, customerId, formData);
    revalidatePath("/customers");
    return { ok: true, message: "Cliente atualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar cliente." };
  }
}

export async function deleteCustomerAction(customerId: string) {
  const user = await requireUser();
  await deleteCustomer(user, customerId);
  revalidatePath("/customers");
}

export async function createProductAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await createProduct(user, formData);
    revalidatePath("/products");
    return { ok: true, message: "Produto salvo." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar produto." };
  }
}

export async function updateProductAction(productId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateProduct(user, productId, formData);
    revalidatePath("/products");
    return { ok: true, message: "Produto atualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar produto." };
  }
}

export async function deleteProductAction(productId: string) {
  const user = await requireUser();
  await deleteProduct(user, productId);
  revalidatePath("/products");
}

export async function createPackageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await createPackage(user, formData);
    revalidatePath("/packages");
    return { ok: true, message: "Embalagem salva." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar embalagem." };
  }
}

export async function updatePackageAction(packageId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updatePackage(user, packageId, formData);
    revalidatePath("/packages");
    return { ok: true, message: "Embalagem atualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar embalagem." };
  }
}

export async function deletePackageAction(packageId: string) {
  const user = await requireUser();
  await deletePackage(user, packageId);
  revalidatePath("/packages");
}

export async function createCurrencyAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await createCurrency(user, formData);
    revalidatePath("/currencies");
    return { ok: true, message: "Moeda salva." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar moeda." };
  }
}

export async function updateCurrencyAction(currencyId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateCurrency(user, currencyId, formData);
    revalidatePath("/currencies");
    return { ok: true, message: "Moeda atualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar moeda." };
  }
}

export async function deleteCurrencyAction(currencyId: string) {
  const user = await requireUser();
  await deleteCurrency(user, currencyId);
  revalidatePath("/currencies");
}


export async function createContractTypeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await createContractType(user, formData); revalidatePath("/contract-types"); return { ok: true, message: "Tipo de contrato salvo." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar tipo de contrato." }; }
}

export async function updateContractTypeAction(id: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await updateContractType(user, id, formData); revalidatePath("/contract-types"); return { ok: true, message: "Tipo de contrato atualizado." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar tipo de contrato." }; }
}

export async function deleteContractTypeAction(id: string) { const user = await requireUser(); await deleteContractType(user, id); revalidatePath("/contract-types"); }

export async function createRawMaterialClosingAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await createRawMaterialClosing(user, formData); revalidatePath("/raw-material-closings"); return { ok: true, message: "Tipo de MP salvo." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar Tipo de MP." }; }
}

export async function updateRawMaterialClosingAction(id: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await updateRawMaterialClosing(user, id, formData); revalidatePath("/raw-material-closings"); return { ok: true, message: "Tipo de MP atualizado." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar Tipo de MP." }; }
}

export async function deleteRawMaterialClosingAction(id: string) { const user = await requireUser(); await deleteRawMaterialClosing(user, id); revalidatePath("/raw-material-closings"); }

export async function createRawMaterialAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await createRawMaterial(user, formData); revalidatePath("/raw-materials"); return { ok: true, message: "Matéria-prima salva." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar matéria-prima." }; }
}

export async function createRawMaterialQuickAction(name: string) {
  const user = await requireUser();
  try { const item = await createRawMaterialQuick(user, name); revalidatePath("/raw-materials"); return { ok: true, item: { id: item.id, name: item.name, active: item.active } }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar matéria-prima." }; }
}

export async function updateRawMaterialAction(id: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await updateRawMaterial(user, id, formData); revalidatePath("/raw-materials"); return { ok: true, message: "Matéria-prima atualizada." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar matéria-prima." }; }
}

export async function deleteRawMaterialAction(id: string) { const user = await requireUser(); await deleteRawMaterial(user, id); revalidatePath("/raw-materials"); }

export async function createSalesResponsibleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await createSalesResponsible(user, formData); revalidatePath("/sales-responsibles"); return { ok: true, message: "Responsável pela venda salvo." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao salvar responsável pela venda." }; }
}

export async function updateSalesResponsibleAction(id: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try { await updateSalesResponsible(user, id, formData); revalidatePath("/sales-responsibles"); return { ok: true, message: "Responsável pela venda atualizado." }; }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar responsável pela venda." }; }
}

export async function deleteSalesResponsibleAction(id: string) { const user = await requireUser(); await deleteSalesResponsible(user, id); revalidatePath("/sales-responsibles"); }

export async function validateBulkImportAction(_state: BulkImportActionState, formData: FormData): Promise<BulkImportActionState> {
  const user = await requireUser();
  const selectedKind = String(formData.get("kind") ?? "");
  try {
    const kind = parseBulkImportKind(formData.get("kind"));
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Selecione um arquivo Excel.");
    const validation = await validateBulkImportWorkbook(user, kind, file);
    return { ok: validation.ok, phase: "validated", selectedKind: kind, validation, message: validation.message };
  } catch (error) {
    return { ok: false, selectedKind, message: error instanceof Error ? error.message : "Não foi possível validar a planilha." };
  }
}

export async function importBulkImportAction(_state: BulkImportActionState, formData: FormData): Promise<BulkImportActionState> {
  const user = await requireUser();
  const selectedKind = String(formData.get("kind") ?? "");
  try {
    const kind = parseBulkImportKind(formData.get("kind"));
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Selecione um arquivo Excel.");
    const result = await importBulkWorkbook(user, kind, file);
    revalidatePath("/customers");
    revalidatePath("/products");
    revalidatePath("/raw-materials");
    revalidatePath("/importacao-em-massa");
    return {
      ok: true,
      phase: "imported",
      selectedKind: kind,
      message: result.imported > 0
        ? "Importação concluída."
        : "Nenhum novo registro para importar. Todos os registros da planilha já estão cadastrados.",
      imported: {
        kind,
        label: bulkImportConfig[kind].pluralLabel,
        count: result.imported,
        analyzed: result.analyzed,
        skippedExisting: result.skippedExisting,
        skippedDuplicated: result.skippedDuplicated
      }
    };
  } catch (error) {
    return { ok: false, selectedKind, message: error instanceof Error ? error.message : "Não foi possível importar a planilha." };
  }
}

export async function createUserAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await createUser(user, formData);
    revalidatePath("/users");
    return { ok: true, message: "Usuário criado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao criar usuário." };
  }
}

export async function updateUserAction(userId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateUser(user, userId, formData);
    revalidatePath("/users");
    return { ok: true, message: "Usuário atualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar usuário." };
  }
}

export async function deleteUserAction(userId: string) {
  const user = await requireUser();
  await deleteUser(user, userId);
  revalidatePath("/users");
}

export async function updateProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await updateOwnProfile(user, formData);
    revalidatePath("/profile");
    return { ok: true, message: "Perfil atualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Erro ao atualizar perfil." };
  }
}
