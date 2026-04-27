import { db, inArray, sql } from "@se-project/db";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { member } from "@se-project/db/schema/auth";
import { event } from "@se-project/db/schema/events";
import { expense, invoice } from "@se-project/db/schema/finance";

export type AssistantIntent =
  | { kind: "command" }
  | { kind: "question"; metric: RagMetric }
  | { kind: "unknown" };

export type RagMetric =
  | "revenue_last_7_days"
  | "pending_invoices"
  | "profit"
  | "upcoming_events";

export type RagDateWindow = {
  from: Date;
  to: Date;
  label: string;
};

export type RagResult = {
  metric: RagMetric;
  data: Record<string, unknown>;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function resolveDateWindow(text: string, now: Date): RagDateWindow {
  const normalized = text.toLowerCase();

  if (normalized.includes("aaj") || normalized.includes("today")) {
    return {
      from: startOfDay(now),
      to: endOfDay(now),
      label: "today",
    };
  }

  if (normalized.includes("kal") || normalized.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      from: startOfDay(tomorrow),
      to: endOfDay(tomorrow),
      label: "tomorrow",
    };
  }

  if (
    normalized.includes("last week")
    || normalized.includes("pichle hafte")
    || normalized.includes("past week")
    || normalized.includes("pichhle 7 din")
    || normalized.includes("last 7 days")
    || normalized.includes("7 days")
    || normalized.includes("7 din")
  ) {
    const to = endOfDay(now);
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return {
      from,
      to,
      label: "last_7_days",
    };
  }

  const to = endOfDay(now);
  const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  return {
    from,
    to,
    label: "last_7_days",
  };
}

export function detectIntent(text: string): AssistantIntent {
  const normalized = text.toLowerCase().trim();

  const commandPattern = /\b(create|add|record|generate|make|bana|banao|banado|create event|add vendor|record payment|create invoice)\b/i;
  if (commandPattern.test(normalized)) {
    return { kind: "command" };
  }

  if (
    /\b(revenue|kamai|earning|income|sales)\b/i.test(normalized)
    && /\b(last\s*7\s*days|7\s*din|last week|pichle\s*hafte|pichhle\s*7\s*din|today|aaj)\b/i.test(normalized)
  ) {
    return { kind: "question", metric: "revenue_last_7_days" };
  }

  if (/\b(pending invoice|unpaid invoice|due invoice|invoice pending|baki invoice|invoice baki)\b/i.test(normalized)) {
    return { kind: "question", metric: "pending_invoices" };
  }

  if (/\b(profit|margin|munafa|net profit)\b/i.test(normalized)) {
    return { kind: "question", metric: "profit" };
  }

  if (/\b(upcoming event|next event|future event|aane wale event|upcoming)\b/i.test(normalized)) {
    return { kind: "question", metric: "upcoming_events" };
  }

  const questionHint = /\?|\b(kitna|kitne|kya|kaun|kab|how much|how many|what|when|show|tell)\b/i;
  if (questionHint.test(normalized)) {
    return { kind: "question", metric: "pending_invoices" };
  }

  return { kind: "unknown" };
}

export async function resolveScopedUserIds(userId: string, activeOrganizationId?: string | null): Promise<string[]> {
  let organizationId = activeOrganizationId ?? null;

  if (!organizationId) {
    const membership = await db.query.member.findFirst({
      where: eq(member.userId, userId),
    });
    organizationId = membership?.organizationId ?? null;
  }

  if (!organizationId) {
    return [userId];
  }

  const memberships = await db.query.member.findMany({
    where: eq(member.organizationId, organizationId),
  });

  if (memberships.length === 0) {
    return [userId];
  }

  return Array.from(new Set(memberships.map((row) => row.userId)));
}

function formatInr(paise: number): string {
  return `Rs ${Number(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildGeminiRagPrompt(query: string, data: Record<string, unknown>): string {
  return [
    `User Query: ${query}`,
    "",
    `Database Data: ${JSON.stringify(data, null, 2)}`,
    "",
    "Instruction:",
    "Explain this in simple Hinglish in a business-friendly tone.",
    "Keep it short, clear, and include key numbers.",
  ].join("\n");
}

export function buildFallbackRagAnswer(metric: RagMetric, data: Record<string, unknown>): string {
  if (metric === "revenue_last_7_days") {
    const total = Number(data.totalRevenue ?? 0);
    return `Last 7 days ka total revenue ${formatInr(total)} hai.`;
  }

  if (metric === "pending_invoices") {
    const count = Number(data.pendingInvoices ?? 0);
    return `Aapke ${count} pending invoices hain.`;
  }

  if (metric === "profit") {
    const revenue = Number(data.revenue ?? 0);
    const expenses = Number(data.expenses ?? 0);
    const profit = Number(data.profit ?? 0);
    return `Current window me revenue ${formatInr(revenue)}, expenses ${formatInr(expenses)}, aur profit ${formatInr(profit)} hai.`;
  }

  const count = Number(data.totalUpcomingEvents ?? 0);
  return `Aaj ke baad ${count} upcoming events scheduled hain.`;
}

export async function runRagQuery(metric: RagMetric, scopedUserIds: string[], queryText: string, now: Date): Promise<RagResult> {
  const scopedEvents = await db
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.createdBy, scopedUserIds));

  const eventIds = scopedEvents.map((row) => row.id);

  if (eventIds.length === 0) {
    return {
      metric,
      data: {
        empty: true,
        message: "No accessible events found for this account.",
        metric,
      },
    };
  }

  const window = resolveDateWindow(queryText, now);

  if (metric === "revenue_last_7_days") {
    const [result] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${event.totalRevenue}), 0)`,
      })
      .from(event)
      .where(
        and(
          inArray(event.id, eventIds),
          gte(event.startDate, window.from),
          lt(event.startDate, new Date(window.to.getTime() + 1)),
        ),
      );

    return {
      metric,
      data: {
        window: {
          label: window.label,
          from: window.from.toISOString(),
          to: window.to.toISOString(),
        },
        totalRevenue: Number(result?.totalRevenue ?? 0),
      },
    };
  }

  if (metric === "pending_invoices") {
    const [result] = await db
      .select({
        pendingInvoices: sql<number>`coalesce(count(*), 0)`,
      })
      .from(invoice)
      .where(
        and(
          inArray(invoice.eventId, eventIds),
          ne(invoice.status, "paid"),
        ),
      );

    return {
      metric,
      data: {
        pendingInvoices: Number(result?.pendingInvoices ?? 0),
      },
    };
  }

  if (metric === "profit") {
    const [revenueResult, expenseResult] = await Promise.all([
      db
        .select({
          revenue: sql<number>`coalesce(sum(${event.totalRevenue}), 0)`,
        })
        .from(event)
        .where(
          and(
            inArray(event.id, eventIds),
            gte(event.startDate, window.from),
            lt(event.startDate, new Date(window.to.getTime() + 1)),
          ),
        ),
      db
        .select({
          expenses: sql<number>`coalesce(sum(${expense.amount}), 0)`,
        })
        .from(expense)
        .where(
          and(
            inArray(expense.eventId, eventIds),
            gte(expense.createdAt, window.from),
            lt(expense.createdAt, new Date(window.to.getTime() + 1)),
          ),
        ),
    ]);

    const revenue = Number(revenueResult[0]?.revenue ?? 0);
    const expenses = Number(expenseResult[0]?.expenses ?? 0);

    return {
      metric,
      data: {
        window: {
          label: window.label,
          from: window.from.toISOString(),
          to: window.to.toISOString(),
        },
        revenue,
        expenses,
        profit: revenue - expenses,
      },
    };
  }

  const upcomingRows = await db
    .select({
      id: event.id,
      name: event.name,
      location: event.location,
      startDate: event.startDate,
      status: event.status,
    })
    .from(event)
    .where(
      and(
        inArray(event.id, eventIds),
        gte(event.startDate, startOfDay(now)),
      ),
    )
    .limit(8);

  return {
    metric,
    data: {
      totalUpcomingEvents: upcomingRows.length,
      events: upcomingRows.map((row) => ({
        id: row.id,
        name: row.name,
        location: row.location,
        startDate: row.startDate?.toISOString?.() ?? row.startDate,
        status: row.status,
      })),
    },
  };
}

