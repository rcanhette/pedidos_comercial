import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth";
import { exportTechnicalListReportPdf, parseTechnicalListReportFilters } from "@/server/technical-list-report-service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const filters = parseTechnicalListReportFilters(new URL(request.url).searchParams);
    const result = await exportTechnicalListReportPdf(user, filters);
    return new NextResponse(new Uint8Array(result.buffer), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${result.filename}"`, "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message ?? "Filtros inválidos." : error instanceof Error ? error.message : "Erro ao gerar PDF.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
