import { z } from "zod";
import { cnpjSchema, decimalInput, freeTextSchema, normalizeFreeText, optionalDateInput, optionalFreeTextSchema } from "./common";

export const NEW_RECORD_VALUE = "__new__";

const requiredMoneyInput = z.union([z.string(), z.number()]).refine((value) => String(value).trim() !== "", "Informe o preço.").transform((value) => String(value).replace(/\./g, "").replace(",", ".")).pipe(z.coerce.number());
const optionalTextInput = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => value === undefined ? undefined : normalizeFreeText(String(value)))
  .refine((value) => value === undefined || value.length <= 200, "Informe no máximo 200 caracteres.");

export const technicalItemsSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return [];
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}, z.array(z.object({
  rawMaterialId: z.string().min(1, "Selecione a matéria-prima."),
  quantityKg: decimalInput.refine((value) => value > 0, "A quantidade em KG deve ser maior que zero."),
  price: requiredMoneyInput.refine((value) => value >= 0, "O preço não pode ser negativo.")
}))).refine((items) => {
  const ids = items.map((item) => item.rawMaterialId);
  return new Set(ids).size === ids.length;
}, "Não repita a mesma matéria-prima no pedido.");

const monthInput = z
  .string()
  .min(1, "Informe a previsão de retirada.")
  .regex(/^\d{4}-\d{2}$/, "Informe mês e ano válidos.")
  .refine((value) => {
    const [year, month] = value.split("-").map(Number);
    return year >= 2000 && month >= 1 && month <= 12;
  }, "Informe mês e ano válidos.")
  .transform((value) => {
    const [year, month] = value.split("-").map(Number);
    return new Date(year, month - 1, 1);
  });

export const orderCreateSchema = z
  .object({
    contractTypeId: z.string().min(1, "Selecione o tipo de contrato."),
    rawMaterialClosingId: z.string().min(1, "Selecione o Tipo de MP."),
    salesResponsibleId: z.string().optional(),
    newSalesResponsibleName: optionalFreeTextSchema(150, 2, "Informe pelo menos 2 caracteres."),
    customerId: z.string().min(1, "Selecione um cliente."),
    newCustomerName: optionalFreeTextSchema(150, 2, "Informe pelo menos 2 caracteres."),
    newCustomerCity: optionalFreeTextSchema(100, 1, "Informe a cidade."),
    newCustomerCnpj: cnpjSchema.optional(),
    productId: z.string().min(1, "Selecione um produto."),
    newProductName: optionalFreeTextSchema(150, 2, "Informe pelo menos 2 caracteres."),
    newProductUnit: optionalFreeTextSchema(30, 1, "Informe a unidade."),
    newProductDescription: optionalFreeTextSchema(500),
    quantity: decimalInput.refine((value) => value > 0, "A quantidade deve ser maior que zero."),
    packageId: z.string().min(1, "Selecione uma embalagem."),
    currencyId: z.string().min(1, "Selecione uma moeda."),
    unitPrice: decimalInput.refine((value) => value >= 0, "O valor unitário não pode ser negativo."),
    dollarRate: optionalTextInput,
    paymentTerms: freeTextSchema(1, 200, "Informe a condição de pagamento."),
    commissionUsd: decimalInput.optional().refine((value) => value === undefined || value >= 0, {
      message: "A comissão não pode ser negativa."
    }),
    paymentDate: optionalDateInput,
    pickupForecast: monthInput,
    freight: optionalTextInput,
    notes: optionalFreeTextSchema(2000),
    technicalItems: technicalItemsSchema
  })
  .refine((data) => data.customerId !== NEW_RECORD_VALUE || Boolean(data.newCustomerName), {
    path: ["newCustomerName"],
    message: "Informe o cliente."
  })
  .refine((data) => data.customerId !== NEW_RECORD_VALUE || Boolean(data.newCustomerCity), {
    path: ["newCustomerCity"],
    message: "Informe a cidade."
  })
  .refine((data) => data.customerId !== NEW_RECORD_VALUE || Boolean(data.newCustomerCnpj), {
    path: ["newCustomerCnpj"],
    message: "Informe um CNPJ válido."
  })
  .refine((data) => data.productId !== NEW_RECORD_VALUE || Boolean(data.newProductName), {
    path: ["newProductName"],
    message: "Informe o produto."
  })
  .refine((data) => data.productId !== NEW_RECORD_VALUE || Boolean(data.newProductUnit), {
    path: ["newProductUnit"],
    message: "Informe a unidade."
  })
  .refine((data) => data.salesResponsibleId !== NEW_RECORD_VALUE || Boolean(data.newSalesResponsibleName), {
    path: ["newSalesResponsibleName"],
    message: "Informe o responsável pela venda."
  });

export const orderStatusSchema = z
  .object({
    status: z.enum(["RECEBIDO", "APROVADO", "EM_CRIACAO", "PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA", "CANCELADO"]),
    sapOrderNumber: z.string().trim().max(100, "Informe no máximo 100 caracteres.").optional(),
    justification: optionalFreeTextSchema(1000)
  })
  .refine((data) => !["PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA"].includes(data.status) || Boolean(data.sapOrderNumber?.trim()), {
    path: ["sapOrderNumber"],
    message: "Informe o Pedido SAP para esta etapa."
  })
  .refine((data) => !["RECEBIDO", "APROVADO", "EM_CRIACAO"].includes(data.status) || !data.sapOrderNumber?.trim(), {
    path: ["sapOrderNumber"],
    message: "O Pedido SAP só pode ser preenchido quando o pedido estiver na etapa Pedido Criado."
  })
  .refine((data) => data.status !== "CANCELADO" || Boolean(data.justification?.trim()), {
    path: ["justification"],
    message: "A justificativa é obrigatória para cancelar."
  });

export const technicalListUpdateSchema = z.object({
  technicalItems: technicalItemsSchema.refine((items) => items.length > 0, "Informe pelo menos uma matéria-prima.")
});

export function formatZodFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((fieldErrors, issue) => {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    return fieldErrors;
  }, {});
}

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
export type TechnicalListUpdateInput = z.infer<typeof technicalListUpdateSchema>;
