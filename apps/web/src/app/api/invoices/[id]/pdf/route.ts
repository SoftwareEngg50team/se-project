import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@se-project/auth";
import React from "react";
import { getInvoiceExportData } from "@/lib/invoice-export";
import { InvoicePDF } from "@/lib/invoice-pdf";

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

  const element = React.createElement(InvoicePDF, {
    data: exportData,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${exportData.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
