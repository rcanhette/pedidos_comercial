import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { catalogQueryFromSearchParams } from "@/lib/catalog-query";

const catalogPages = [
  "src/app/(app)/customers/page.tsx",
  "src/app/(app)/products/page.tsx",
  "src/app/(app)/packages/page.tsx",
  "src/app/(app)/currencies/page.tsx",
  "src/app/(app)/contract-types/page.tsx",
  "src/app/(app)/raw-material-closings/page.tsx",
  "src/app/(app)/raw-materials/page.tsx"
];

describe("paginação e pesquisa dos cadastros", () => {
  it("normaliza parâmetros de pesquisa e página", async () => {
    await expect(catalogQueryFromSearchParams(Promise.resolve({ search: " A ", page: "3" }))).resolves.toEqual({ search: " A ", page: 3 });
    await expect(catalogQueryFromSearchParams(Promise.resolve({ page: "-1" }))).resolves.toEqual({ search: "", page: 1 });
  });

  it("limita cadastros a 50 linhas por página", () => {
    const service = readFileSync("src/server/catalog-service.ts", "utf8");
    expect(service).toContain("export const catalogPageSize = 50");
    expect(service).toContain("take: catalogPageSize");
    expect(service).toContain("skip: (page - 1) * catalogPageSize");
  });

  it("filtra cadastros por termo em qualquer parte dos campos pesquisáveis", () => {
    const service = readFileSync("src/server/catalog-service.ts", "utf8");
    expect(service.match(/contains: search/g)?.length).toBeGreaterThanOrEqual(7);
    expect(service).toContain('mode: "insensitive"');
  });

  it("todas as páginas de cadastro usam o serviço paginado", () => {
    for (const page of catalogPages) {
      const source = readFileSync(page, "utf8");
      expect(source).toContain("catalogQueryFromSearchParams");
      expect(source).toContain("listCatalog(");
      expect(source).not.toContain("prisma.");
    }
  });

  it("exibe controles de pesquisa e próxima página nos managers", () => {
    const source = readFileSync("src/features/admin/catalog-forms.tsx", "utf8");
    expect(source).toContain('placeholder="Pesquisar"');
    expect(source).toContain("router.replace(catalogPageHref(pathname, value.trim(), 1))");
    expect(source).toContain("Anterior");
    expect(source).toContain("Próxima");
  });
});
