import { NextRequest, NextResponse } from "next/server";
import { auth } from "@se-project/auth";
import { db, desc } from "@se-project/db";
import { event } from "@se-project/db/schema/events";

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

  const records = await db.query.event.findMany({
    orderBy: desc(event.createdAt),
  });

  const rows = records.map((entry) => ({
    id: entry.id,
    name: entry.name,
    status: entry.status,
    startDate: entry.startDate,
    endDate: entry.endDate,
    location: entry.location,
    clientName: entry.clientName,
    clientPhone: entry.clientPhone,
    clientEmail: entry.clientEmail,
    totalRevenuePaise: entry.totalRevenue,
    createdAt: entry.createdAt,
  }));

  const csv = toCsv(rows, [
    "id",
    "name",
    "status",
    "startDate",
    "endDate",
    "location",
    "clientName",
    "clientPhone",
    "clientEmail",
    "totalRevenuePaise",
    "createdAt",
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="events-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
