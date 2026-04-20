import { NextRequest, NextResponse } from "next/server";
import { auth } from "@se-project/auth";
import { env } from "@se-project/env/server";
import { db, eq } from "@se-project/db";
import { invoice } from "@se-project/db/schema/finance";
import { getInvoiceExportData } from "@/lib/invoice-export";
import { sendInvoiceViaGmail } from "@/lib/invoice-email";

type RequestBody = {
  to?: string;
  subject?: string;
  message?: string;
};

function formatDefaultSubject(invoiceNumber: string, eventName: string) {
  return `Invoice ${invoiceNumber} for ${eventName}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as RequestBody;

  const exportData = await getInvoiceExportData({
    invoiceId: id,
    sessionUserId: session.user.id,
    activeOrganizationId: session.session.activeOrganizationId,
  });

  if (!exportData) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const recipient = body.to?.trim() || exportData.event.clientEmail || exportData.branding.email;
  if (!recipient) {
    return NextResponse.json(
      { error: "Recipient email is required. Add a client email or provide one in the request." },
      { status: 400 },
    );
  }

  const subject = body.subject?.trim() || formatDefaultSubject(exportData.invoiceNumber, exportData.event.name);

  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      {
        error: "Invoice email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD on the server.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await sendInvoiceViaGmail({
      to: recipient,
      subject,
      message: body.message,
      data: exportData,
    });

    if (exportData.status === "draft") {
      await db.update(invoice).set({ status: "sent" }).where(eq(invoice.id, id));
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      sentTo: recipient,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    return NextResponse.json(
      {
        error: "Failed to send invoice email.",
        details: message,
      },
      { status: 502 },
    );
  }
}
