import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@se-project/auth";
import {
  formatInvoiceDate,
  getInvoiceExportData,
  paymentTypeLabel,
} from "@/lib/invoice-export";

function toArgb(hex: string) {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  const exportData = await getInvoiceExportData({
    invoiceId: id,
    sessionUserId: session.user.id,
    activeOrganizationId: session.session.activeOrganizationId,
  });

  if (!exportData) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = exportData.branding.organizationName;
  wb.company = exportData.branding.organizationName;
  wb.created = new Date();

  const ws = wb.addWorksheet("Invoice");
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.views = [{ showGridLines: false }];
  ws.columns = [
    { width: 16 },
    { width: 18 },
    { width: 34 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
  ];

  const brandColor = toArgb(exportData.branding.accentColor);
  const lightFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFF8FAFC" },
  };
  const solidFill = (color: string) => ({
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: color },
  });
  const cellBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  function metaRow(rowNumber: number, label: string, value: string) {
    const row = ws.getRow(rowNumber);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
    row.getCell(2).value = value;
    row.height = 18;
  }

  function sectionHeader(rowNumber: number, labels: string[]) {
    const row = ws.getRow(rowNumber);
    labels.forEach((label, index) => {
      const cell = row.getCell(index + 1);
      cell.value = label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = solidFill(brandColor);
      cell.alignment = { vertical: "middle" };
    });
    row.height = 20;
  }

  let row = 1;

  ws.mergeCells(`A${row}:F${row}`);
  ws.getRow(row).getCell(1).fill = solidFill(brandColor);
  ws.getRow(row).height = 8;
  row++;

  ws.mergeCells(`A${row}:D${row}`);
  ws.getRow(row).getCell(1).value = exportData.branding.organizationName;
  ws.getRow(row).getCell(1).font = {
    size: 20,
    bold: true,
    color: { argb: brandColor },
  };
  ws.mergeCells(`E${row}:F${row}`);
  ws.getRow(row).getCell(5).value = "INVOICE";
  ws.getRow(row).getCell(5).font = {
    size: 22,
    bold: true,
    color: { argb: brandColor },
  };
  ws.getRow(row).getCell(5).alignment = { horizontal: "right" };
  ws.getRow(row).height = 28;
  row++;

  if (exportData.branding.address) {
    ws.mergeCells(`A${row}:D${row}`);
    ws.getRow(row).getCell(1).value = exportData.branding.address;
    ws.getRow(row).getCell(1).font = { color: { argb: "FF475569" } };
    row++;
  }

  const companyContact = [
    exportData.branding.phone,
    exportData.branding.email,
    exportData.branding.website,
    exportData.branding.taxId,
  ].filter(Boolean);
  if (companyContact.length > 0) {
    ws.mergeCells(`A${row}:D${row}`);
    ws.getRow(row).getCell(1).value = companyContact.join("  |  ");
    ws.getRow(row).getCell(1).font = { color: { argb: "FF475569" } };
    row++;
  }

  metaRow(row++, "Invoice Number", exportData.invoiceNumber);
  metaRow(row++, "Status", exportData.status.toUpperCase());
  metaRow(row++, "Issued On", formatInvoiceDate(exportData.issuedAt));
  metaRow(row++, "Due Date", formatInvoiceDate(exportData.dueDate));
  row++;

  sectionHeader(row++, ["Bill To", "", "Event", "", "", ""]);
  ws.mergeCells(`A${row}:B${row}`);
  ws.getRow(row).getCell(1).value = exportData.event.clientName;
  ws.mergeCells(`C${row}:F${row}`);
  ws.getRow(row).getCell(3).value = exportData.event.name;
  row++;
  if (exportData.event.clientPhone || exportData.event.clientEmail) {
    ws.mergeCells(`A${row}:B${row}`);
    ws.getRow(row).getCell(1).value = [
      exportData.event.clientPhone,
      exportData.event.clientEmail,
    ].filter(Boolean).join("  |  ");
    ws.mergeCells(`C${row}:F${row}`);
    ws.getRow(row).getCell(3).value = exportData.event.location;
    row++;
  }
  ws.mergeCells(`C${row}:F${row}`);
  ws.getRow(row).getCell(3).value = `${formatInvoiceDate(exportData.event.startDate)} - ${formatInvoiceDate(exportData.event.endDate)}`;
  row += 2;

  sectionHeader(row++, ["Service Date", "Description", "", "Qty", "Unit Price", "Amount"]);
  exportData.lineItems.forEach((item, index) => {
    const currentRow = ws.getRow(row++);
    currentRow.getCell(1).value = formatInvoiceDate(item.serviceDate ?? exportData.event.startDate);
    ws.mergeCells(`B${currentRow.number}:C${currentRow.number}`);
    currentRow.getCell(2).value = item.description;
    currentRow.getCell(4).value = item.quantity;
    currentRow.getCell(4).alignment = { horizontal: "right" };
    currentRow.getCell(5).value = item.unitPrice / 100;
    currentRow.getCell(6).value = item.lineTotal / 100;
    currentRow.getCell(5).numFmt = '"₹"#,##0.00';
    currentRow.getCell(6).numFmt = '"₹"#,##0.00';
    currentRow.getCell(5).alignment = { horizontal: "right" };
    currentRow.getCell(6).alignment = { horizontal: "right" };
    if (index % 2 === 1) {
      currentRow.eachCell((cell) => {
        cell.fill = lightFill;
      });
    }
    currentRow.eachCell((cell) => {
      cell.border = cellBorder;
      cell.alignment = {
        ...cell.alignment,
        vertical: "middle",
        wrapText: true,
      };
    });
  });
  row++;

  if (exportData.payments.length > 0) {
    sectionHeader(row++, ["Payment Date", "Type", "Method", "Notes", "", "Amount"]);
    exportData.payments.forEach((paymentEntry, index) => {
      const currentRow = ws.getRow(row++);
      currentRow.getCell(1).value = formatInvoiceDate(paymentEntry.paymentDate);
      currentRow.getCell(2).value = paymentTypeLabel[paymentEntry.type] ?? paymentEntry.type;
      currentRow.getCell(3).value = paymentEntry.paymentMethod ?? "-";
      ws.mergeCells(`D${currentRow.number}:E${currentRow.number}`);
      currentRow.getCell(4).value = paymentEntry.notes ?? "-";
      currentRow.getCell(6).value = paymentEntry.amount / 100;
      currentRow.getCell(6).numFmt = '"₹"#,##0.00';
      currentRow.getCell(6).alignment = { horizontal: "right" };
      if (index % 2 === 1) {
        currentRow.eachCell((cell) => {
          cell.fill = lightFill;
        });
      }
      currentRow.eachCell((cell) => {
        cell.border = cellBorder;
        cell.alignment = {
          ...cell.alignment,
          vertical: "middle",
          wrapText: true,
        };
      });
    });
    row++;
  }

  function totalRow(label: string, amount: number, highlight = false) {
    const currentRow = ws.getRow(row++);
    ws.mergeCells(`A${currentRow.number}:E${currentRow.number}`);
    currentRow.getCell(1).value = label;
    currentRow.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
    currentRow.getCell(1).alignment = { horizontal: "right" };
    currentRow.getCell(6).value = amount / 100;
    currentRow.getCell(6).numFmt = '"₹"#,##0.00';
    currentRow.getCell(6).alignment = { horizontal: "right" };
    if (highlight) {
      currentRow.eachCell((cell) => {
        cell.fill = solidFill(brandColor);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      });
    }
  }

  totalRow("Subtotal", exportData.subtotal);
  totalRow("Amount Paid", exportData.totalPaid);
  totalRow("Balance Due", exportData.balanceDue, true);
  row++;

  ws.mergeCells(`A${row}:F${row}`);
  ws.getRow(row).getCell(1).value = `Prepared by ${exportData.creator.name} (${exportData.creator.email})`;
  ws.getRow(row).getCell(1).font = { color: { argb: "FF475569" } };
  row += 2;

  ws.mergeCells(`A${row}:C${row}`);
  ws.getRow(row).getCell(1).value = "Payment";
  ws.getRow(row).getCell(1).font = { bold: true, size: 12, color: { argb: brandColor } };

  ws.mergeCells(`D${row}:F${row}`);
  ws.getRow(row).getCell(4).value = "Notes";
  ws.getRow(row).getCell(4).font = { bold: true, size: 12, color: { argb: brandColor } };
  row++;

  if (exportData.paymentQrDataUrl) {
    const qrId = wb.addImage({
      base64: exportData.paymentQrDataUrl,
      extension: "png",
    });
    ws.addImage(qrId, {
      tl: { col: 0, row: row - 1 },
      ext: { width: 120, height: 120 },
    });
  }

  ws.mergeCells(`D${row}:F${row + 4}`);
  const noteCell = ws.getRow(row).getCell(4);
  noteCell.value = [
    exportData.branding.upiId ? `UPI: ${exportData.branding.upiId}` : null,
    exportData.branding.bankName ? `Bank: ${exportData.branding.bankName}` : null,
    exportData.branding.bankAccountName ? `A/C Name: ${exportData.branding.bankAccountName}` : null,
    exportData.branding.bankAccountNumber ? `A/C No: ${exportData.branding.bankAccountNumber}` : null,
    exportData.branding.bankIfsc ? `IFSC: ${exportData.branding.bankIfsc}` : null,
    exportData.branding.paymentTerms,
    exportData.branding.paymentNotes,
  ].filter(Boolean).join("\n");
  noteCell.alignment = { wrapText: true, vertical: "top" };
  row += 6;

  if (exportData.event.notes) {
    ws.mergeCells(`A${row}:F${row}`);
    ws.getRow(row).getCell(1).value = `Event note: ${exportData.event.notes}`;
    ws.getRow(row).getCell(1).font = { italic: true, color: { argb: "FF475569" } };
  }

  ws.eachRow((sheetRow) => {
    sheetRow.eachCell((cell) => {
      if (!cell.alignment) {
        cell.alignment = { vertical: "middle" };
      }
    });
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportData.invoiceNumber}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
