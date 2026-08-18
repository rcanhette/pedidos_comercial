import fs from "fs";
import { describe, expect, it } from "vitest";
import { buildTechnicalListReportFilterSummary, buildTechnicalListReportOrderBy, buildTechnicalListReportWhere, technicalListReportCommission, technicalListReportFilename, technicalListReportRepresentative, type TechnicalListReportUserScope } from "@/lib/technical-list-report";
import { technicalListReportPageSize, technicalListReportQuerySchema } from "@/validations/technical-list-report";

function parse(input: URLSearchParams) { return technicalListReportQuerySchema.parse(Object.fromEntries(input.entries())); }
function user(overrides: Partial<TechnicalListReportUserScope> = {}): TechnicalListReportUserScope { return { id: "user_1", fullName: "Usuário Teste", permissions: ["RELATORIO_VISUALIZAR", "PEDIDO_VISUALIZAR_TODOS"], ...overrides }; }

describe("relatório da lista técnica", () => {
  it("consulta sem filtros com paginação e ordenação padrão", () => {
    const query = parse(new URLSearchParams());
    expect(query.page).toBe(1);
    expect(query.sort).toBe("solicitationAt");
    expect(query.direction).toBe("desc");
    expect(technicalListReportPageSize).toBe(20);
    expect(buildTechnicalListReportWhere(query, user())).toEqual({ order: {} });
    expect(buildTechnicalListReportOrderBy(query)[0]).toEqual({ order: { solicitationAt: "desc" } });
  });

  it("aplica filtros combinados com AND", () => {
    const query = parse(new URLSearchParams({ pedidoSap: " SAP-1 ", createdFrom: "2026-07-01", createdTo: "2026-07-31", pickupFrom: "2026-08", pickupTo: "2026-12", rawMaterialId: "raw_1", page: "2" }));
    expect(query.pedidoSap).toBe("SAP-1");
    expect(query.page).toBe(2);
    expect(buildTechnicalListReportWhere(query, user())).toMatchObject({
      rawMaterialId: "raw_1",
      order: {
        sapOrderNumber: { contains: "SAP-1", mode: "insensitive" },
        solicitationAt: { gte: new Date("2026-07-01T00:00:00.000Z"), lt: new Date("2026-08-01T00:00:00.000Z") },
        pickupForecast: { gte: new Date("2026-08-01T00:00:00.000Z"), lt: new Date("2027-01-01T00:00:00.000Z") }
      }
    });
  });

  it("restringe representante aos próprios pedidos e impede sem permissão", () => {
    const representative = user({ permissions: ["RELATORIO_VISUALIZAR", "PEDIDO_VISUALIZAR_PROPRIOS"] });
    expect(buildTechnicalListReportWhere(parse(new URLSearchParams()), representative)).toEqual({ order: { createdById: "user_1" } });
    expect(() => buildTechnicalListReportWhere(parse(new URLSearchParams()), user({ permissions: ["PEDIDO_VISUALIZAR_TODOS"] }))).toThrow();
  });

  it("rejeita períodos inválidos e gera resumo", () => {
    expect(() => parse(new URLSearchParams({ createdFrom: "2026-08-01", createdTo: "2026-07-31" }))).toThrow();
    expect(() => parse(new URLSearchParams({ pickupFrom: "2026-12", pickupTo: "2026-08" }))).toThrow();
    const query = parse(new URLSearchParams({ pedidoSap: "SAP-1", rawMaterialId: "raw_1", pickupFrom: "2026-08" }));
    expect(buildTechnicalListReportFilterSummary(query, { rawMaterial: "Milho" })).toEqual(["Pedido SAP: SAP-1", "Previsão de Retirada: 08/2026 até fim", "Matéria-prima: Milho"]);
    expect(technicalListReportFilename("xlsx", new Date("2026-07-22T10:30:00"))).toBe("relatorio-lista-tecnica-2026-07-22-103000.xlsx");
  });

  it("usa uma linha por item e exatamente as colunas solicitadas", () => {
    const component = fs.readFileSync("src/features/reports/technical-list-report.tsx", "utf8");
    const service = fs.readFileSync("src/server/technical-list-report-service.ts", "utf8");
    const expected = ["Pedido SAP", "Cliente", "Representante", "Data de Criação", "Previsão de Retirada", "Matéria-prima", "Quantidade em KG", "Quantidade em TONS", "Preço", "Comissão"];
    for (const label of expected) expect(component + service).toContain(label);
    expect(service).toContain("prisma.orderRawMaterial.findMany");
    expect(service).toContain("order: {");
    expect(service).toContain("select: {");
    expect(service).toContain("customerName");
    expect(service).toContain("representativeName");
    expect(service).toContain("createdBy: { select: { fullName: true } }");
    expect(service).toContain("commissionUsdCents");
    expect(component).not.toContain("Cotação do Dólar");
    expect(service).not.toContain("Cotação do Dólar");
    expect(component).not.toContain("ID do Pedido");
    expect(service).not.toContain("sequentialId");
  });

  it("usa responsável pela venda antes do usuário que gerou o pedido", () => {
    const items = [
      { order: { salesResponsibleNameSnapshot: "ANA VENDAS", representativeName: "JOÃO DA SILVA", createdBy: { fullName: "MARIA SOUZA" }, commissionUsdCents: 25000 } },
      { order: { salesResponsibleNameSnapshot: null, representativeName: "JOÃO DA SILVA", createdBy: { fullName: "CARLOS PEREIRA" }, commissionUsdCents: 25000 } }
    ];

    expect(items.map(technicalListReportRepresentative)).toEqual(["ANA VENDAS", "JOÃO DA SILVA"]);
    expect(items.map(technicalListReportCommission)).toEqual(["US$ 250,00", "US$ 250,00"]);
  });

  it("não quebra pedido antigo sem representante ou comissão", () => {
    const item = { order: { representativeName: null, createdBy: null, commissionUsdCents: null } };
    expect(technicalListReportRepresentative(item)).toBe("Não informado");
    expect(technicalListReportCommission(item)).toBe("-");
  });
});
