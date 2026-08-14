// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cnpjSchema, decimalInput, normalizeFreeText, passwordSchema } from "@/validations/common";
import { customerSchema, productSchema, simpleCatalogSchema } from "@/validations/catalog";
import { orderCreateSchema, orderStatusSchema } from "@/validations/order";
import { userCreateSchema } from "@/validations/user";

const validOrder = {
  contractTypeId: "contract_1",
  rawMaterialClosingId: "closing_1",
  customerId: "cust_1",
  productId: "prod_1",
  quantity: "10,5",
  packageId: "pack_1",
  currencyId: "cur_1",
  unitPrice: "123,45",
  commissionUsd: "1,00",
  paymentDate: "2026-07-10",
  pickupForecast: "2026-07",
  technicalItems: JSON.stringify([{ rawMaterialId: "raw_1", quantityKg: "25", price: "150,00" }])
};

describe("normalização de texto livre em maiúsculo", () => {
  it("normaliza texto preservando acentos, hífen e espaços internos", () => {
    expect(normalizeFreeText("  cliente teste  ")).toBe("CLIENTE TESTE");
    expect(normalizeFreeText("São José")).toBe("SÃO JOSÉ");
    expect(normalizeFreeText("matéria-prima")).toBe("MATÉRIA-PRIMA");
    expect(normalizeFreeText("CLIENTE  TESTE")).toBe("CLIENTE  TESTE");
  });

  it("normaliza cadastros no backend sem alterar CNPJ", () => {
    const customer = customerSchema.parse({ name: "cliente teste", city: "São José", cnpj: "11.222.333/0001-81", active: true });
    expect(customer.name).toBe("CLIENTE TESTE");
    expect(customer.city).toBe("SÃO JOSÉ");
    expect(customer.cnpj).toBe("11222333000181");

    expect(productSchema.parse({ name: "matéria-prima", unit: "kg", description: "  especial  ", active: true })).toMatchObject({
      name: "MATÉRIA-PRIMA",
      unit: "KG",
      description: "ESPECIAL"
    });
    expect(simpleCatalogSchema.parse({ name: "tipo contrato", active: true }).name).toBe("TIPO CONTRATO");
  });

  it("normaliza pedido, textarea e edição enviada manualmente em minúsculo", () => {
    const parsed = orderCreateSchema.parse({
      ...validOrder,
      customerId: "__new__",
      newCustomerName: "cliente teste",
      newCustomerCity: "São José",
      newCustomerCnpj: "11.222.333/0001-81",
      productId: "__new__",
      newProductName: "matéria-prima",
      newProductUnit: "kg",
      newProductDescription: "produto especial",
      dollarRate: "ptax do faturamento",
      paymentTerms: "30 dias",
      freight: "fob - retirar",
      notes: "cliente solicita retirada\nantecipada"
    });

    expect(parsed.newCustomerName).toBe("CLIENTE TESTE");
    expect(parsed.newCustomerCity).toBe("SÃO JOSÉ");
    expect(parsed.newCustomerCnpj).toBe("11222333000181");
    expect(parsed.newProductName).toBe("MATÉRIA-PRIMA");
    expect(parsed.newProductUnit).toBe("KG");
    expect(parsed.newProductDescription).toBe("PRODUTO ESPECIAL");
    expect(parsed.dollarRate).toBe("PTAX DO FATURAMENTO");
    expect(parsed.paymentTerms).toBe("30 DIAS");
    expect(parsed.freight).toBe("FOB - RETIRAR");
    expect(parsed.notes).toBe("CLIENTE SOLICITA RETIRADA\nANTECIPADA");
  });

  it("não altera Pedido SAP, senha, e-mail, números, datas e valores financeiros", () => {
    expect(orderStatusSchema.parse({ status: "PEDIDO_CRIADO", sapOrderNumber: "sap-001", justification: "pedido criado" })).toMatchObject({
      sapOrderNumber: "sap-001",
      justification: "PEDIDO CRIADO"
    });
    expect(passwordSchema.parse("SenhaForte#123")).toBe("SenhaForte#123");
    expect(cnpjSchema.parse("11.222.333/0001-81")).toBe("11222333000181");
    expect(decimalInput.parse("1.234,56")).toBe(1234.56);

    const user = userCreateSchema.parse({
      fullName: "usuário teste",
      username: "usuario.teste",
      email: "usuario@empresa.com.br",
      phone: "(41) 99999-0000",
      cpf: "123.456.789-00",
      position: "vendedor",
      roleIds: ["role_1"],
      password: "SenhaForte#123",
      confirmPassword: "SenhaForte#123",
      active: true
    });
    expect(user.fullName).toBe("USUÁRIO TESTE");
    expect(user.username).toBe("usuario.teste");
    expect(user.email).toBe("usuario@empresa.com.br");
    expect(user.phone).toBe("(41) 99999-0000");
    expect(user.cpf).toBe("12345678900");
    expect(user.position).toBe("VENDEDOR");
    expect(user.password).toBe("SenhaForte#123");
  });

  it("mostra Input e Textarea em maiúsculo durante a digitação", () => {
    render(React.createElement("div", null, [
      React.createElement(Input, { key: "input", "aria-label": "Cliente", normalizeUppercase: true }),
      React.createElement(Textarea, { key: "textarea", "aria-label": "Observações", normalizeUppercase: true })
    ]));

    const input = screen.getByLabelText("Cliente") as HTMLInputElement;
    const textarea = screen.getByLabelText("Observações") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "São José" } });
    fireEvent.change(textarea, { target: { value: "matéria-prima\nespecial" } });

    expect(input.value).toBe("SÃO JOSÉ");
    expect(textarea.value).toBe("MATÉRIA-PRIMA\nESPECIAL");
  });
});
