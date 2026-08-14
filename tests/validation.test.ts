import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { isValidCnpj } from "@/utils/cnpj";
import { formatZodFieldErrors, orderCreateSchema, orderStatusSchema } from "@/validations/order";
import { passwordSchema } from "@/validations/common";
import { hasPermission, rolePermissionMap } from "@/lib/permissions";
import { calculateTechnicalTonsScaled, formatMoneyCents, formatQuantityScaled, formatQuantityScaledFixed, moneyInputToCents, quantityInputToScaled, rateInputToScaled } from "@/lib/scalars";

describe("validações comerciais", () => {
  const validOrder = {
    contractTypeId: "contract_1",
    rawMaterialClosingId: "closing_1",
    customerId: "cust_1",
    productId: "prod_1",
    quantity: "10,5",
    packageId: "pack_1",
    currencyId: "cur_1",
    unitPrice: "123,45",
    dollarRate: "5,1234",
    paymentTerms: "30 dias",
    commissionUsd: "1,00",
    paymentDate: "2026-07-10",
    pickupForecast: "2026-07",
    freight: "0",
    notes: "Observação",
    technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "25", price: "150,00" }])
  };

  it("aceita CNPJ válido e rejeita inválido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("associa CNPJ inválido ao campo sem perder os demais dados enviados", () => {
    const parsed = orderCreateSchema.safeParse({
      ...validOrder,
      customerId: "__new__",
      newCustomerName: "Cliente Preservado",
      newCustomerCity: "Cidade Preservada",
      newCustomerCnpj: "11.222.333/0001-82"
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = formatZodFieldErrors(parsed.error);
      expect(fieldErrors.newCustomerCnpj).toContain("CNPJ inválido. Verifique os números informados.");
      expect(fieldErrors.newCustomerName).toBeUndefined();
      expect(fieldErrors.newCustomerCity).toBeUndefined();
    }
  });

  it("rejeita quantidade inválida", () => {
    const parsed = orderCreateSchema.safeParse({ ...validOrder, quantity: "0" });
    expect(parsed.success).toBe(false);
  });

  it("normaliza decimais brasileiros", () => {
    const parsed = orderCreateSchema.parse(validOrder);
    expect(parsed.quantity).toBe(10.5);
    expect(parsed.unitPrice).toBe(123.45);
  });

  it("mantém Frete como string textual no payload validado do pedido", () => {
    const textFreight = orderCreateSchema.parse({ ...validOrder, freight: "FOB - retirar na fábrica" });
    expect(textFreight.freight).toBe("FOB - RETIRAR NA FÁBRICA");

    const moneyFreight = orderCreateSchema.parse({ ...validOrder, freight: "1.234,56" });
    expect(moneyFreight.freight).toBe("1.234,56");
    expect(moneyInputToCents(moneyFreight.freight)).toBe(123456);
  });

  it("mantém Cotação do dólar como texto no payload validado do pedido", () => {
    const textRate = orderCreateSchema.parse({ ...validOrder, dollarRate: "PTAX do dia do faturamento" });
    expect(textRate.dollarRate).toBe("PTAX DO DIA DO FATURAMENTO");

    const numericRate = orderCreateSchema.parse({ ...validOrder, dollarRate: "5,4321" });
    expect(numericRate.dollarRate).toBe("5,4321");
    expect(rateInputToScaled(numericRate.dollarRate)).toBe(54321);
  });

  it("exige dados quando cliente ou produto novo e selecionado", () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, customerId: "__new__" }).success).toBe(false);
    expect(orderCreateSchema.safeParse({ ...validOrder, productId: "__new__" }).success).toBe(false);
    expect(orderCreateSchema.safeParse({
      ...validOrder,
      customerId: "__new__",
      newCustomerName: "Cliente Novo",
      newCustomerCity: "Curitiba",
      newCustomerCnpj: "11.222.333/0001-81",
      productId: "__new__",
      newProductName: "Produto Novo",
      newProductUnit: "kg"
    }).success).toBe(true);
  });


  it("exige novos campos comerciais do pedido", () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, contractTypeId: "" }).success).toBe(false);
    expect(orderCreateSchema.safeParse({ ...validOrder, rawMaterialClosingId: "" }).success).toBe(false);
  });

  it("valida previsão de retirada por mês e ano", () => {
    const parsed = orderCreateSchema.parse(validOrder);
    expect(parsed.pickupForecast.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(orderCreateSchema.safeParse({ ...validOrder, pickupForecast: "2026-13" }).success).toBe(false);
    expect(orderCreateSchema.safeParse({ ...validOrder, pickupForecast: "2026-07-20" }).success).toBe(false);
  });

  it("aceita lista técnica ausente no payload do formulário", () => {
    const parsed = orderCreateSchema.parse({ ...validOrder, technicalItems: "[]" });
    expect(parsed.technicalItems).toEqual([]);
    expect(orderCreateSchema.parse({ ...validOrder, technicalItems: undefined }).technicalItems).toEqual([]);
  });

  it("exige lista técnica válida quando ela é enviada", () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "0", price: "150,00" }]) }).success).toBe(false);
    expect(orderCreateSchema.safeParse({ ...validOrder, technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "1", price: "150,00" }, { rawMaterialId: "raw_1", quantityKg: "2", price: "151,00" }]) }).success).toBe(false);
  });


  it("exige preço válido em cada matéria-prima", () => {
    expect(orderCreateSchema.safeParse({ ...validOrder, technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "25", price: "" }]) }).success).toBe(false);
    expect(orderCreateSchema.safeParse({ ...validOrder, technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "25", price: "-1" }]) }).success).toBe(false);
    const parsed = orderCreateSchema.parse({ ...validOrder, technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "25", price: "1.250,50" }]) });
    expect(parsed.technicalItems[0].price).toBe(1250.5);
  });

  it("mantém erros de Lista Técnica vinculados à linha e ao campo corretos", () => {
    const parsed = orderCreateSchema.safeParse({
      ...validOrder,
      technicalItems: JSON.stringify([
        { rawMaterialId: "raw_1", quantityKg: "25", price: "150,00" },
        { rawMaterialId: "", quantityKg: "0", price: "" }
      ])
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = formatZodFieldErrors(parsed.error);
      expect(fieldErrors["technicalItems.1.rawMaterialId"]).toContain("Selecione a matéria-prima.");
      expect(fieldErrors["technicalItems.1.quantityKg"]).toContain("A quantidade em KG deve ser maior que zero.");
      expect(fieldErrors["technicalItems.1.price"]).toContain("Informe o preço.");
      expect(fieldErrors["technicalItems.0.rawMaterialId"]).toBeUndefined();
    }
  });

  it("calcula quantidade em TONS com três casas", () => {
    expect(calculateTechnicalTonsScaled(quantityInputToScaled("25") ?? 0, quantityInputToScaled("50") ?? 0)).toBe(1250);
    expect(calculateTechnicalTonsScaled(quantityInputToScaled("12,5") ?? 0, quantityInputToScaled("100") ?? 0)).toBe(1250);
    const a = calculateTechnicalTonsScaled(quantityInputToScaled("25") ?? 0, quantityInputToScaled("20") ?? 0);
    const b = calculateTechnicalTonsScaled(quantityInputToScaled("10") ?? 0, quantityInputToScaled("20") ?? 0);
    expect(formatQuantityScaledFixed(a + b)).toBe("0,700");
  });

  it("converte valores para inteiros escalados do PostgreSQL", () => {
    expect(moneyInputToCents("15,90")).toBe(1590);
    expect(quantityInputToScaled("10,500")).toBe(10500);
    expect(rateInputToScaled("5,4321")).toBe(54321);
    expect(formatMoneyCents(1590, "BRL")).toContain("15,90");
    expect(formatQuantityScaled(10500)).toBe("10,5");
  });

  it("valida novos status e Pedido SAP", () => {
    expect(orderStatusSchema.safeParse({ status: "RECUSADO", justification: "Crédito recusado" }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ status: "APROVADO", sapOrderNumber: "SAP-1" }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ status: "EM_CRIACAO", sapOrderNumber: "SAP-1" }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ status: "PEDIDO_CRIADO", sapOrderNumber: "" }).success).toBe(false);
    expect(orderStatusSchema.safeParse({ status: "PEDIDO_CRIADO", sapOrderNumber: "SAP-1" }).success).toBe(true);
    expect(orderStatusSchema.safeParse({ status: "ENVIADO_PARA_ASSINATURA", sapOrderNumber: "SAP-1" }).success).toBe(true);
    expect(orderStatusSchema.safeParse({ status: "CANCELADO", justification: "" }).success).toBe(false);
  });

  it("valida política de senha", () => {
    expect(passwordSchema.safeParse("Fraca123").success).toBe(false);
    expect(passwordSchema.safeParse("SenhaForte#123").success).toBe(true);
  });


  it("exibe Tipo de MP nos pontos principais de interface", () => {
    const files = [
      "src/features/orders/order-form.tsx",
      "src/app/(app)/orders/[id]/page.tsx",
      "src/features/reports/sales-report.tsx",
      "src/features/sales-dashboard/sales-dashboard-panel.tsx",
      "src/app/(app)/raw-material-closings/page.tsx",
      "src/app/(app)/layout.tsx"
    ];
    const visibleText = files.map((path) => readFileSync(path, "utf8")).join("\n");
    expect(visibleText).toContain("Tipo de MP");
    expect(visibleText).not.toMatch(/Fechamento(s)? de MP|Fechamento MP/);
  });

  it("separa o cadastro da Lista Técnica da edição normal do pedido", () => {
    const action = readFileSync("src/app/actions.ts", "utf8");
    const editPage = readFileSync("src/app/(app)/orders/[id]/edit/page.tsx", "utf8");
    const technicalPage = readFileSync("src/app/(app)/orders/[id]/technical-list/page.tsx", "utf8");
    const technicalForm = readFileSync("src/features/orders/technical-list-form.tsx", "utf8");

    expect(action).toContain("updateTechnicalListAction");
    expect(action).toContain('formData.get("technicalItems")');
    expect(action).not.toContain('technicalListUpdateSchema.safeParse(parseFormData(formData))');
    expect(editPage).toContain("canEditTechnicalList={false}");
    expect(technicalPage).toContain('roles.includes("Representante Externo")');
    expect(technicalForm).toContain('name="technicalItems"');
    expect(technicalForm).not.toContain('name="customerId"');
    expect(technicalForm).not.toContain('name="productId"');
    expect(technicalForm).not.toContain('name="quantity"');
  });

  it("preserva valores do formulário de pedido quando ações retornam erro", () => {
    const action = readFileSync("src/app/actions.ts", "utf8");
    const orderForm = readFileSync("src/features/orders/order-form.tsx", "utf8");
    const technicalForm = readFileSync("src/features/orders/technical-list-form.tsx", "utf8");

    expect(action).toContain("values?: Record<string, string>");
    expect(action).toContain("formDataValues(formData)");
    expect(action).toContain("formatZodFieldErrors(parsed.error), values");
    expect(action).toContain("orderServiceFieldErrors(error)");
    expect(orderForm).toContain("useState<OrderFormValues>");
    expect(orderForm).toContain("setFormValues((current) => ({ ...current, ...pickOrderValues(state.values) }))");
    expect(orderForm).toContain("parseTechnicalRows(state.values.technicalItems)");
    expect(orderForm).toContain('data-field-error="newCustomerCnpj"');
    expect(orderForm).not.toContain("reset()");
    expect(technicalForm).toContain("parseTechnicalRows(state.values?.technicalItems)");
    expect(technicalForm).toContain("technicalItems.${index}.price");
    expect(technicalForm).not.toContain("reset()");
  });

  it("configura ID sequencial de pedido vindo do banco e exibe Pedido SAP nas listas", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const migration = readFileSync("prisma/migrations/20260722143500_add_sequential_order_id_and_sap_report_filter/migration.sql", "utf8");
    const table = readFileSync("src/features/orders/orders-table.tsx", "utf8");
    const details = readFileSync("src/app/(app)/orders/[id]/page.tsx", "utf8");

    expect(schema).toContain("sequentialId                   Int                  @unique @default(autoincrement())");
    expect(migration).toContain('ROW_NUMBER() OVER (ORDER BY "solicitationAt" ASC, "id" ASC)');
    expect(migration).toContain('CREATE SEQUENCE "Order_sequentialId_seq"');
    expect(table.indexOf(">ID<")).toBeLessThan(table.indexOf(">Pedido SAP<"));
    expect(table.indexOf(">Pedido SAP<")).toBeLessThan(table.indexOf(">Solicitação<"));
    expect(table).toContain("order.sequentialId");
    expect(table).toContain('order.sapOrderNumber || "—"');
    expect(details).toContain("ID do Pedido");
    expect(details).toContain("order.sequentialId");
  });

  it("confere matriz dos perfis finais", () => {
    expect(rolePermissionMap.Administrator).toContain("PERMISSAO_CONFIGURAR");
    expect(rolePermissionMap.Gestor).toContain("USUARIO_CRIAR");
    expect(rolePermissionMap.Gestor).not.toContain("PERMISSAO_CONFIGURAR");
    expect(rolePermissionMap.Analista).toContain("PEDIDO_VISUALIZAR_TODOS");
    expect(rolePermissionMap.Analista).not.toContain("USUARIO_VISUALIZAR");
    expect(rolePermissionMap["Representante Externo"]).toContain("PEDIDO_VISUALIZAR_PROPRIOS");
    expect(rolePermissionMap["Representante Externo"]).not.toContain("PEDIDO_VISUALIZAR_TODOS");
    expect(rolePermissionMap["Representante Externo"]).not.toContain("PEDIDO_ALTERAR_STATUS");
    expect(rolePermissionMap["Representante Externo"]).toContain("CLIENTE_CRIAR");
    expect(rolePermissionMap["Representante Externo"]).not.toContain("MATERIA_PRIMA_CRIAR");
  });

  it("confere permissão concedida", () => {
    expect(hasPermission(["PEDIDO_VISUALIZAR_PROPRIOS"], "PEDIDO_VISUALIZAR_PROPRIOS")).toBe(true);
    expect(hasPermission(["PEDIDO_VISUALIZAR_PROPRIOS"], "PEDIDO_VISUALIZAR_TODOS")).toBe(false);
  });
});
