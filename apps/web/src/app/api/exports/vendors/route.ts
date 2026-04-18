import { NextRequest, NextResponse } from "next/server";
import { auth } from "@se-project/auth";
import { db, desc } from "@se-project/db";
import { vendor } from "@se-project/db/schema/finance";

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

  const records = await db.query.vendor.findMany({
    orderBy: desc(vendor.createdAt),
  });

  const rows = records.map((entry) => ({
    id: entry.id,
    name: entry.name,
    type: entry.type,
    phone: entry.phone,
    email: entry.email,
    createdAt: entry.createdAt,
  }));

  const csv = toCsv(rows, ["id", "name", "type", "phone", "email", "createdAt"]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendors-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
