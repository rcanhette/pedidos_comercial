import fs from "fs";
import { describe, expect, it } from "vitest";
import { buildSalesReportFilterSummary, buildSalesReportWhere, salesReportFilename, salesReportRepresentative, type SalesReportUserScope } from "@/lib/sales-report";
import { salesReportQuerySchema } from "@/validations/sales-report";

function parseSalesReportQuery(input: URLSearchParams) {
  return salesReportQuerySchema.parse(Object.fromEntries(input.entries()));
}

function user(overrides: Partial<SalesReportUserScope> = {}): SalesReportUserScope {
  return {
    id: "user_1",
    fullName: "Usuário Teste",
    permissions: ["RELATORIO_VISUALIZAR", "PEDIDO_VISUALIZAR_TODOS"],
    ...overrides
  };
}

describe("relatório de vendas", () => {
  it("consulta sem filtros com ordenação padrão e página 1", () => {
    const query = parseSalesReportQuery(new URLSearchParams());
    expect(query.page).toBe(1);
    expect(query.sort).toBe("solicitationAt");
    expect(query.direction).toBe("desc");
    expect(buildSalesReportWhere(query, user())).toEqual({});
  });

  it("aplica filtros independentes e combinados com AND no Prisma", () => {
    const query = parseSalesReportQuery(new URLSearchParams({
      customerId: "cust_1",
      productId: "prod_1",
      contractTypeId: "contract_1",
      rawMaterialClosingId: "closing_1",
      status: "APROVADO",
      pedidoSap: " SAP-2026-001 ",
      createdFrom: "2026-07-01",
      createdTo: "2026-07-31",
      pickupForecast: "2026-08"
    }));
    expect(buildSalesReportWhere(query, user())).toMatchObject({
      customerId: "cust_1",
      productId: "prod_1",
      contractTypeId: "contract_1",
      rawMaterialClosingId: "closing_1",
      status: "APROVADO",
      sapOrderNumber: { contains: "SAP-2026-001", mode: "insensitive" },
      solicitationAt: {
        gte: new Date("2026-07-01T00:00:00.000Z"),
        lt: new Date("2026-08-01T00:00:00.000Z")
      },
      pickupForecast: {
        gte: new Date("2026-08-01T00:00:00.000Z"),
        lt: new Date("2026-09-01T00:00:00.000Z")
      }
    });
  });

  it("limpa filtros vazios e permite consultar todos os pedidos permitidos", () => {
    const query = parseSalesReportQuery(new URLSearchParams({ customerId: "", productId: "", pickupForecast: "", page: "2" }));
    expect(query.customerId).toBeUndefined();
    expect(query.productId).toBeUndefined();
    expect(query.pickupForecast).toBeUndefined();
    expect(query.page).toBe(2);
  });

  it("rejeita períodos inválidos", () => {
    expect(() => parseSalesReportQuery(new URLSearchParams({ createdFrom: "2026-08-01", createdTo: "2026-07-31" }))).toThrow();
    expect(() => parseSalesReportQuery(new URLSearchParams({ pickupForecast: "2026-13" }))).toThrow();
    expect(() => parseSalesReportQuery(new URLSearchParams({ status: "INVALIDO" }))).toThrow();
  });

  it("restringe representante externo aos próprios pedidos", () => {
    const representative = user({ permissions: ["RELATORIO_VISUALIZAR", "PEDIDO_VISUALIZAR_PROPRIOS"] });
    expect(buildSalesReportWhere(parseSalesReportQuery(new URLSearchParams()), representative)).toEqual({ createdById: "user_1" });
  });

  it("impede acesso sem permissão de relatório ou sem escopo de pedidos", () => {
    expect(() => buildSalesReportWhere(parseSalesReportQuery(new URLSearchParams()), user({ permissions: ["PEDIDO_VISUALIZAR_TODOS"] }))).toThrow();
    expect(() => buildSalesReportWhere(parseSalesReportQuery(new URLSearchParams()), user({ permissions: ["RELATORIO_VISUALIZAR"] }))).toThrow();
  });

  it("gera resumo dos filtros e nome de arquivo exportável", () => {
    const query = parseSalesReportQuery(new URLSearchParams({ pedidoSap: "SAP-1", customerId: "cust_1", status: "APROVADO", pickupForecast: "2026-08" }));
    expect(buildSalesReportFilterSummary(query, { customer: "Cliente A" })).toEqual([
      "Pedido SAP: SAP-1",
      "Cliente: Cliente A",
      "Status: Aprovado",
      "Previsão de Retirada: 08/2026"
    ]);
    expect(buildSalesReportFilterSummary(parseSalesReportQuery(new URLSearchParams()))).toEqual(["Todos os pedidos permitidos"]);
    expect(salesReportFilename("xlsx", new Date("2026-07-16T15:30:00"))).toBe("relatorio-vendas-2026-07-16-153000.xlsx");
    expect(salesReportFilename("pdf", new Date("2026-07-16T15:30:00"))).toBe("relatorio-vendas-2026-07-16-153000.pdf");
  });

  it("usa Pedido SAP como identificação principal no relatório", () => {
    const table = fs.readFileSync("src/features/reports/sales-report.tsx", "utf8");
    const service = fs.readFileSync("src/server/sales-report-service.ts", "utf8");
    expect(table).toContain("Pedido SAP");
    expect(table).not.toContain("Número do Pedido");
    expect(table).not.toContain("ID do Pedido");
    expect(service).toContain('"Pedido SAP"');
    expect(service).toContain("freightText: true");
    expect(service).not.toContain('"Número do Pedido"');
    expect(service).not.toContain('"ID do Pedido"');
  });

  it("exibe responsável pela venda antes do usuário que gerou o pedido", () => {
    expect(salesReportRepresentative({ salesResponsibleNameSnapshot: "ANA VENDAS", representativeName: "USUARIO CRIADOR" })).toBe("ANA VENDAS");
    expect(salesReportRepresentative({ salesResponsibleNameSnapshot: null, representativeName: "USUARIO CRIADOR" })).toBe("USUARIO CRIADOR");
    expect(salesReportRepresentative({ salesResponsibleNameSnapshot: "", representativeName: "" })).toBe("Não informado");
  });
});
