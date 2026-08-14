import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertPermission, getRequestMeta, type CurrentUser } from "./auth";
import { auditLog } from "./audit";
import { appName } from "@/lib/app-config";
import { formatCnpj, formatDateTimeBr, formatMonthYearBr } from "@/lib/format";
import { centsToDecimal, formatQuantityScaled, quantityScaledToDecimal, rateScaledToDecimal } from "@/lib/scalars";
import { buildSalesReportFilterSummary, buildSalesReportOrderBy, buildSalesReportWhere, salesReportFilename, salesReportStatusLabel, salesReportText } from "@/lib/sales-report";
import {
  salesReportFiltersSchema,
  salesReportPageSize,
  salesReportQuerySchema,
  type SalesReportFiltersInput,
  type SalesReportQueryInput
} from "@/validations/sales-report";

export type SalesReportOrder = Prisma.OrderGetPayload<{ select: typeof salesReportOrderSelect }>;

export const salesReportOrderSelect = {
  id: true,
  representativeName: true,
  createdById: true,
  customerId: true,
  customerName: true,
  city: true,
  cnpj: true,
  productId: true,
  productNameSnapshot: true,
  contractTypeId: true,
  contractTypeNameSnapshot: true,
  rawMaterialClosingId: true,
  rawMaterialClosingNameSnapshot: true,
  quantityScaled: true,
  packageNameSnapshot: true,
  currencyCodeSnapshot: true,
  unitPriceCents: true,
  dollarRateScaled: true,
  dollarRateText: true,
  paymentTerms: true,
  commissionUsdCents: true,
  pickupForecast: true,
  freightCents: true,
  freightText: true,
  notes: true,
  status: true,
  sapOrderNumber: true,
  solicitationAt: true
} satisfies Prisma.OrderSelect;

function parseInput(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  if (input instanceof URLSearchParams) {
    return Object.fromEntries(input.entries());
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
}

export function parseSalesReportQuery(input: URLSearchParams | Record<string, string | string[] | undefined>): SalesReportQueryInput {
  return salesReportQuerySchema.parse(parseInput(input));
}

export function parseSalesReportFilters(input: URLSearchParams | Record<string, string | string[] | undefined>): SalesReportFiltersInput {
  return salesReportFiltersSchema.parse(parseInput(input));
}


export async function getSalesReportOptions(user: CurrentUser) {
  assertPermission(user, "RELATORIO_VISUALIZAR");
  const [customers, products, contractTypes, rawMaterialClosings] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, city: true, active: true }, orderBy: [{ name: "asc" }, { city: "asc" }] }),
    prisma.product.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.contractType.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.rawMaterialClosing.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } })
  ]);
  return { customers, products, contractTypes, rawMaterialClosings };
}

async function filterLabels(filters: SalesReportFiltersInput) {
  const [customer, product, contractType, rawMaterialClosing] = await Promise.all([
    filters.customerId ? prisma.customer.findUnique({ where: { id: filters.customerId }, select: { name: true, city: true } }) : null,
    filters.productId ? prisma.product.findUnique({ where: { id: filters.productId }, select: { name: true } }) : null,
    filters.contractTypeId ? prisma.contractType.findUnique({ where: { id: filters.contractTypeId }, select: { name: true } }) : null,
    filters.rawMaterialClosingId ? prisma.rawMaterialClosing.findUnique({ where: { id: filters.rawMaterialClosingId }, select: { name: true } }) : null
  ]);
  return {
    customer: customer ? `${customer.name} - ${customer.city}` : undefined,
    product: product?.name,
    contractType: contractType?.name,
    rawMaterialClosing: rawMaterialClosing?.name
  };
}

export async function listSalesReportOrders(user: CurrentUser, query: SalesReportQueryInput) {
  const where = buildSalesReportWhere(query, user);
  const page = query.page;
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: salesReportOrderSelect,
      orderBy: buildSalesReportOrderBy(query),
      skip: (page - 1) * salesReportPageSize,
      take: salesReportPageSize
    }),
    prisma.order.count({ where })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / salesReportPageSize));
  const labels = await filterLabels(query);
  await auditLog({
    action: "SALES_REPORT_VIEWED",
    entity: "SalesReport",
    userId: user.id,
    afterData: { filters: query, total, page },
    ...(await getRequestMeta())
  });
  return {
    orders,
    total,
    page,
    pageSize: salesReportPageSize,
    totalPages,
    filterSummary: buildSalesReportFilterSummary(query, labels)
  };
}

async function listAllSalesReportOrders(user: CurrentUser, filters: SalesReportFiltersInput) {
  const where = buildSalesReportWhere(filters, user);
  return prisma.order.findMany({
    where,
    select: salesReportOrderSelect,
    orderBy: { solicitationAt: "desc" }
  });
}

function generatedAt() {
  return new Date();
}

function salesReportFreight(order: Pick<SalesReportOrder, "freightText" | "freightCents">) {
  const text = order.freightText?.trim();
  if (text) return text;
  return centsToDecimal(order.freightCents) ?? "Não informado";
}

function salesReportDollarRate(order: Pick<SalesReportOrder, "dollarRateText" | "dollarRateScaled">) {
  const text = order.dollarRateText?.trim();
  if (text) return text;
  return rateScaledToDecimal(order.dollarRateScaled) ?? "Não informado";
}

export async function exportSalesReportExcel(user: CurrentUser, filters: SalesReportFiltersInput) {
  const [orders, labels] = await Promise.all([listAllSalesReportOrders(user, filters), filterLabels(filters)]);
  const now = generatedAt();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = appName;
  workbook.created = now;
  const sheet = workbook.addWorksheet("Relatório", {
    views: [{ state: "frozen", ySplit: 6 }]
  });

  sheet.addRow(["Relatório"]);
  sheet.addRow(["Gerado em", formatDateTimeBr(now)]);
  sheet.addRow(["Gerado por", user.fullName]);
  sheet.addRow(["Filtros aplicados", buildSalesReportFilterSummary(filters, labels).join("; ")]);
  sheet.addRow([]);

  const columns = [
    "Pedido SAP",
    "Data de Criação",
    "Representante",
    "Cliente",
    "Cidade",
    "CNPJ",
    "Produto",
    "Tipo de Contrato",
    "Tipo de MP",
    "Quantidade",
    "Embalagem",
    "Moeda",
    "Valor Unitário",
    "Cotação do Dólar",
    "Condição de Pagamento",
    "Comissão USD",
    "Previsão de Retirada",
    "Frete",
    "Status",
    "Observações"
  ];
  const header = sheet.addRow(columns);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };

  for (const order of orders) {
    sheet.addRow([
      salesReportText(order.sapOrderNumber),
      order.solicitationAt,
      salesReportText(order.representativeName),
      salesReportText(order.customerName),
      salesReportText(order.city),
      order.cnpj ? formatCnpj(order.cnpj) : "Não informado",
      salesReportText(order.productNameSnapshot),
      salesReportText(order.contractTypeNameSnapshot),
      salesReportText(order.rawMaterialClosingNameSnapshot),
      quantityScaledToDecimal(order.quantityScaled),
      salesReportText(order.packageNameSnapshot),
      salesReportText(order.currencyCodeSnapshot),
      centsToDecimal(order.unitPriceCents),
      salesReportDollarRate(order),
      salesReportText(order.paymentTerms),
      centsToDecimal(order.commissionUsdCents),
      order.pickupForecast ? formatMonthYearBr(order.pickupForecast) : "Não informado",
      salesReportFreight(order),
      salesReportStatusLabel(order.status),
      order.notes ?? ""
    ]);
  }

  sheet.getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
  sheet.getColumn(10).numFmt = '#,##0.000';
  sheet.getColumn(13).numFmt = '#,##0.00';
  sheet.getColumn(14).numFmt = '#,##0.0000';
  sheet.getColumn(16).numFmt = '#,##0.00';
  sheet.getColumn(18).numFmt = '#,##0.00';
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: columns.length } };
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(Math.max(columns[index]?.length ?? 12, 14), index === 19 ? 45 : 28);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  await auditLog({
    action: "SALES_REPORT_EXPORTED_EXCEL",
    entity: "SalesReport",
    userId: user.id,
    afterData: { filters, total: orders.length, format: "xlsx" },
    ...(await getRequestMeta())
  });
  return { buffer: Buffer.from(buffer), filename: salesReportFilename("xlsx", now), total: orders.length };
}

export async function exportSalesReportPdf(user: CurrentUser, filters: SalesReportFiltersInput) {
  const [orders, labels] = await Promise.all([listAllSalesReportOrders(user, filters), filterLabels(filters)]);
  const now = generatedAt();
  const buffer = await buildPdfBuffer(user, filters, labels, orders, now);
  await auditLog({
    action: "SALES_REPORT_EXPORTED_PDF",
    entity: "SalesReport",
    userId: user.id,
    afterData: { filters, total: orders.length, format: "pdf" },
    ...(await getRequestMeta())
  });
  return { buffer, filename: salesReportFilename("pdf", now), total: orders.length };
}

async function buildPdfBuffer(
  user: CurrentUser,
  filters: SalesReportFiltersInput,
  labels: Awaited<ReturnType<typeof filterLabels>>,
  orders: SalesReportOrder[],
  now: Date
) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const tableTop = 132;
  const rowHeight = 28;
  const bottom = doc.page.height - 48;
  const columns = [
    { label: "Pedido SAP", width: 76 },
    { label: "Criação", width: 76 },
    { label: "Representante", width: 86 },
    { label: "Cliente", width: 112 },
    { label: "Produto", width: 96 },
    { label: "Contrato", width: 82 },
    { label: "Fech. MP", width: 76 },
    { label: "Qtd.", width: 48 },
    { label: "Retirada", width: 58 },
    { label: "Status", width: 76 }
  ];

  function drawHeader() {
    doc.fontSize(16).font("Helvetica-Bold").text("Relatório", 28, 24);
    doc.fontSize(8).font("Helvetica").text(`Gerado em: ${formatDateTimeBr(now)}`, 28, 48);
    doc.text(`Usuário: ${user.fullName}`, 28, 62);
    doc.text(`Total de pedidos: ${orders.length}`, 28, 76);
    doc.text(`Filtros aplicados: ${buildSalesReportFilterSummary(filters, labels).join("; ")}`, 28, 90, { width: doc.page.width - 56 });
    drawTableHeader(tableTop);
  }

  function drawTableHeader(y: number) {
    let x = 28;
    doc.rect(28, y, doc.page.width - 56, 22).fill("#1f2937");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
    for (const column of columns) {
      doc.text(column.label, x + 3, y + 7, { width: column.width - 6, ellipsis: true });
      x += column.width;
    }
    doc.fillColor("#111827").font("Helvetica");
  }

  function drawRow(order: SalesReportOrder, y: number) {
    const values = [
      order.sapOrderNumber || "Não informado",
      formatDateTimeBr(order.solicitationAt),
      salesReportText(order.representativeName),
      salesReportText(order.customerName),
      salesReportText(order.productNameSnapshot),
      salesReportText(order.contractTypeNameSnapshot),
      salesReportText(order.rawMaterialClosingNameSnapshot),
      formatQuantityScaled(order.quantityScaled),
      formatMonthYearBr(order.pickupForecast),
      salesReportStatusLabel(order.status)
    ];
    let x = 28;
    doc.rect(28, y, doc.page.width - 56, rowHeight).strokeColor("#e5e7eb").stroke();
    doc.fillColor("#111827").fontSize(6.5).font("Helvetica");
    values.forEach((value, index) => {
      doc.text(value, x + 3, y + 5, { width: columns[index].width - 6, height: rowHeight - 7, ellipsis: true });
      x += columns[index].width;
    });
  }

  drawHeader();
  let y = tableTop + 22;
  for (const order of orders) {
    if (y + rowHeight > bottom) {
      doc.addPage();
      drawHeader();
      y = tableTop + 22;
    }
    drawRow(order, y);
    y += rowHeight;
  }

  if (orders.length === 0) {
    doc.fontSize(10).text("Nenhum pedido encontrado para os filtros selecionados.", 28, y + 16);
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    doc.fontSize(8).fillColor("#6b7280").text(`Página ${index + 1} de ${range.count}`, 28, doc.page.height - 34, { align: "right", width: doc.page.width - 56 });
  }
  doc.end();
  return done;
}
