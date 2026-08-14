import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertPermission, getRequestMeta, type CurrentUser } from "./auth";
import { auditLog } from "./audit";
import { appName } from "@/lib/app-config";
import { formatDateTimeBr, formatMonthYearBr } from "@/lib/format";
import { centsToDecimal, formatMoneyCents, formatQuantityScaledFixed, quantityScaledToDecimal } from "@/lib/scalars";
import { buildTechnicalListReportFilterSummary, buildTechnicalListReportOrderBy, buildTechnicalListReportWhere, technicalListReportCommission, technicalListReportFilename, technicalListReportRepresentative, technicalListReportText } from "@/lib/technical-list-report";
import { technicalListReportFiltersSchema, technicalListReportPageSize, technicalListReportQuerySchema, type TechnicalListReportFiltersInput, type TechnicalListReportQueryInput } from "@/validations/technical-list-report";

export const technicalListReportItemSelect = {
  id: true,
  rawMaterialId: true,
  rawMaterialNameSnapshot: true,
  quantityKgScaled: true,
  quantityTonsScaled: true,
  priceCents: true,
  order: {
    select: {
      sapOrderNumber: true,
      customerName: true,
      representativeName: true,
      solicitationAt: true,
      pickupForecast: true,
      currencyCodeSnapshot: true,
      commissionUsdCents: true,
      createdById: true,
      createdBy: { select: { fullName: true } }
    }
  }
} satisfies Prisma.OrderRawMaterialSelect;

export type TechnicalListReportItem = Prisma.OrderRawMaterialGetPayload<{ select: typeof technicalListReportItemSelect }>;

function parseInput(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries());
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

export function parseTechnicalListReportQuery(input: URLSearchParams | Record<string, string | string[] | undefined>): TechnicalListReportQueryInput {
  return technicalListReportQuerySchema.parse(parseInput(input));
}

export function parseTechnicalListReportFilters(input: URLSearchParams | Record<string, string | string[] | undefined>): TechnicalListReportFiltersInput {
  return technicalListReportFiltersSchema.parse(parseInput(input));
}

export async function getTechnicalListReportOptions(user: CurrentUser) {
  assertPermission(user, "RELATORIO_VISUALIZAR");
  const rawMaterials = await prisma.rawMaterial.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } });
  return { rawMaterials };
}

async function filterLabels(filters: TechnicalListReportFiltersInput) {
  const rawMaterial = filters.rawMaterialId ? await prisma.rawMaterial.findUnique({ where: { id: filters.rawMaterialId }, select: { name: true } }) : null;
  return { rawMaterial: rawMaterial?.name };
}

export async function listTechnicalListReportItems(user: CurrentUser, query: TechnicalListReportQueryInput) {
  const where = buildTechnicalListReportWhere(query, user);
  const page = query.page;
  const [items, total] = await prisma.$transaction([
    prisma.orderRawMaterial.findMany({ where, select: technicalListReportItemSelect, orderBy: buildTechnicalListReportOrderBy(query), skip: (page - 1) * technicalListReportPageSize, take: technicalListReportPageSize }),
    prisma.orderRawMaterial.count({ where })
  ]);
  const labels = await filterLabels(query);
  await auditLog({ action: "TECHNICAL_LIST_REPORT_VIEWED", entity: "TechnicalListReport", userId: user.id, afterData: { filters: query, total, page }, ...(await getRequestMeta()) });
  return { items, total, page, pageSize: technicalListReportPageSize, totalPages: Math.max(1, Math.ceil(total / technicalListReportPageSize)), filterSummary: buildTechnicalListReportFilterSummary(query, labels) };
}

async function listAllTechnicalListReportItems(user: CurrentUser, filters: TechnicalListReportFiltersInput) {
  return prisma.orderRawMaterial.findMany({ where: buildTechnicalListReportWhere(filters, user), select: technicalListReportItemSelect, orderBy: [{ order: { solicitationAt: "desc" } }, { order: { sapOrderNumber: "asc" } }, { rawMaterialNameSnapshot: "asc" }] });
}

function generatedAt() { return new Date(); }

const columns = ["Pedido SAP", "Cliente", "Representante", "Data de Criação", "Previsão de Retirada", "Matéria-prima", "Quantidade em KG", "Quantidade em TONS", "Preço", "Comissão"];

export async function exportTechnicalListReportExcel(user: CurrentUser, filters: TechnicalListReportFiltersInput) {
  const [items, labels] = await Promise.all([listAllTechnicalListReportItems(user, filters), filterLabels(filters)]);
  const now = generatedAt();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = appName;
  workbook.created = now;
  const sheet = workbook.addWorksheet("Lista Técnica", { views: [{ state: "frozen", ySplit: 6 }] });
  sheet.addRow(["Relatório da Lista Técnica"]);
  sheet.addRow(["Gerado em", formatDateTimeBr(now)]);
  sheet.addRow(["Gerado por", user.fullName]);
  sheet.addRow(["Filtros aplicados", buildTechnicalListReportFilterSummary(filters, labels).join("; ")]);
  sheet.addRow([]);
  const header = sheet.addRow(columns);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  for (const item of items) sheet.addRow([technicalListReportText(item.order.sapOrderNumber), technicalListReportText(item.order.customerName), technicalListReportRepresentative(item), item.order.solicitationAt, item.order.pickupForecast ? formatMonthYearBr(item.order.pickupForecast) : "Não informado", technicalListReportText(item.rawMaterialNameSnapshot), quantityScaledToDecimal(item.quantityKgScaled), quantityScaledToDecimal(item.quantityTonsScaled), centsToDecimal(item.priceCents), centsToDecimal(item.order.commissionUsdCents)]);
  sheet.getColumn(4).numFmt = "dd/mm/yyyy hh:mm";
  sheet.getColumn(7).numFmt = '#,##0.000';
  sheet.getColumn(8).numFmt = '#,##0.000';
  sheet.getColumn(9).numFmt = '#,##0.00';
  sheet.getColumn(10).numFmt = '"US$" #,##0.00';
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: columns.length } };
  sheet.columns.forEach((column, index) => { column.width = Math.min(Math.max(columns[index]?.length ?? 14, 16), 34); });
  const buffer = await workbook.xlsx.writeBuffer();
  await auditLog({ action: "TECHNICAL_LIST_REPORT_EXPORTED_EXCEL", entity: "TechnicalListReport", userId: user.id, afterData: { filters, total: items.length, format: "xlsx" }, ...(await getRequestMeta()) });
  return { buffer: Buffer.from(buffer), filename: technicalListReportFilename("xlsx", now), total: items.length };
}

export async function exportTechnicalListReportPdf(user: CurrentUser, filters: TechnicalListReportFiltersInput) {
  const [items, labels] = await Promise.all([listAllTechnicalListReportItems(user, filters), filterLabels(filters)]);
  const now = generatedAt();
  const buffer = await buildPdfBuffer(user, filters, labels, items, now);
  await auditLog({ action: "TECHNICAL_LIST_REPORT_EXPORTED_PDF", entity: "TechnicalListReport", userId: user.id, afterData: { filters, total: items.length, format: "pdf" }, ...(await getRequestMeta()) });
  return { buffer, filename: technicalListReportFilename("pdf", now), total: items.length };
}

async function buildPdfBuffer(user: CurrentUser, filters: TechnicalListReportFiltersInput, labels: Awaited<ReturnType<typeof filterLabels>>, items: TechnicalListReportItem[], now: Date) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const tableTop = 132, rowHeight = 26, bottom = doc.page.height - 48;
  const pdfColumns = [{ label: "Pedido SAP", width: 70 }, { label: "Cliente", width: 120 }, { label: "Representante", width: 100 }, { label: "Data de Criação", width: 72 }, { label: "Previsão", width: 54 }, { label: "Matéria-prima", width: 122 }, { label: "KG", width: 52 }, { label: "TONS", width: 52 }, { label: "Preço", width: 62 }, { label: "Comissão", width: 62 }];
  function drawHeader() {
    doc.fontSize(16).font("Helvetica-Bold").text("Relatório da Lista Técnica", 28, 24);
    doc.fontSize(8).font("Helvetica").text(`Gerado em: ${formatDateTimeBr(now)}`, 28, 48);
    doc.text(`Usuário: ${user.fullName}`, 28, 62);
    doc.text(`Total de linhas: ${items.length}`, 28, 76);
    doc.text(`Filtros aplicados: ${buildTechnicalListReportFilterSummary(filters, labels).join("; ")}`, 28, 90, { width: doc.page.width - 56 });
    let x = 28;
    doc.rect(28, tableTop, doc.page.width - 56, 22).fill("#1f2937");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
    for (const column of pdfColumns) { doc.text(column.label, x + 3, tableTop + 7, { width: column.width - 6, ellipsis: true }); x += column.width; }
    doc.fillColor("#111827").font("Helvetica");
  }
  function drawRow(item: TechnicalListReportItem, y: number) {
    const values = [technicalListReportText(item.order.sapOrderNumber), technicalListReportText(item.order.customerName), technicalListReportRepresentative(item), formatDateTimeBr(item.order.solicitationAt), formatMonthYearBr(item.order.pickupForecast), technicalListReportText(item.rawMaterialNameSnapshot), formatQuantityScaledFixed(item.quantityKgScaled), formatQuantityScaledFixed(item.quantityTonsScaled), formatMoneyCents(item.priceCents, item.order.currencyCodeSnapshot), technicalListReportCommission(item)];
    let x = 28;
    doc.rect(28, y, doc.page.width - 56, rowHeight).strokeColor("#e5e7eb").stroke();
    doc.fillColor("#111827").fontSize(6.5).font("Helvetica");
    values.forEach((value, index) => { doc.text(value, x + 3, y + 5, { width: pdfColumns[index].width - 6, height: rowHeight - 7, ellipsis: true }); x += pdfColumns[index].width; });
  }
  drawHeader();
  let y = tableTop + 22;
  for (const item of items) { if (y + rowHeight > bottom) { doc.addPage(); drawHeader(); y = tableTop + 22; } drawRow(item, y); y += rowHeight; }
  if (items.length === 0) doc.fontSize(10).text("Nenhum item de Lista Técnica encontrado para os filtros selecionados.", 28, y + 16);
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) { doc.switchToPage(index); doc.fontSize(8).fillColor("#6b7280").text(`Página ${index + 1} de ${range.count}`, 28, doc.page.height - 34, { align: "right", width: doc.page.width - 56 }); }
  doc.end();
  return done;
}
