import { NextResponse } from "next/server";
import { assertBulkImportPermission, createBulkImportTemplateWorkbook, parseBulkImportKind, userCanAccessBulkImport } from "@/server/bulk-import-service";
import { requireUser } from "@/server/auth";

const templateFileNames = {
  customers: "modelo_importacao_clientes.xlsx",
  products: "modelo_importacao_produtos.xlsx",
  rawMaterials: "modelo_importacao_materias_primas.xlsx"
};

export async function GET(request: Request) {
  const user = await requireUser();
  if (!userCanAccessBulkImport(user)) return new NextResponse("Não autorizado.", { status: 403 });

  const kindParam = new URL(request.url).searchParams.get("kind");
  const kind = kindParam ? parseBulkImportKind(kindParam) : undefined;
  if (kind) assertBulkImportPermission(user, kind);

  const file = await createBulkImportTemplateWorkbook(kind);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${kind ? templateFileNames[kind] : "modelo_importacao_cadastros.xlsx"}"`
    }
  });
}
