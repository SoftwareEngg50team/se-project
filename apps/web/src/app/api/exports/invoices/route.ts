import { NextRequest, NextResponse } from "next/server";
import { auth } from "@se-project/auth";
import { db, desc } from "@se-project/db";
import { invoice } from "@se-project/db/schema/finance";

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = value instanceof Date ? value.toISOString() : String(value);
  if (/[,"\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  const head = headers.join(",");
  const body = rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const records = await db.query.invoice.findMany({
    orderBy: desc(invoice.issuedAt),
    with: {
      event: true,
      payments: true,
    },
  });

  const rows = records.map((entry) => {
    const totalPaid = entry.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return {
      id: entry.id,
      invoiceNumber: entry.invoiceNumber,
      status: entry.status,
      eventName: entry.event?.name ?? "",
      amountPaise: entry.amount,
      totalPaidPaise: totalPaid,
      balancePaise: Math.max(entry.amount - totalPaid, 0),
      dueDate: entry.dueDate,
      issuedAt: entry.issuedAt,
    };
  });

  const csv = toCsv(rows, [
    "id",
    "invoiceNumber",
    "status",
    "eventName",
    "amountPaise",
    "totalPaidPaise",
    "balancePaise",
    "dueDate",
    "issuedAt",
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
