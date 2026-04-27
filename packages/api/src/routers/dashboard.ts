import { z } from "zod";
import { db, eq, desc, sql, and, inArray } from "@se-project/db";
import { event } from "@se-project/db/schema/events";
import { expense, invoice, payment } from "@se-project/db/schema/finance";
import { protectedProcedure } from "../index";
import {
  eventSchema,
  paymentWithEventSchema,
} from "../schemas";
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

export const dashboardRouter = {
  getFinancialSummary: protectedProcedure
    .route({
      tags: ["Dashboard"],
      summary: "Get financial summary",
      description:
        "Aggregate financial metrics across all events — total revenue, expenses, customer payments, vendor payments, and outstanding invoice amounts.",
    })
    .output(
      z.object({
        totalRevenue: z.number(),
        totalExpenses: z.number(),
        totalCustomerPayments: z.number(),
        totalVendorPayments: z.number(),
        outstandingInvoices: z.number(),
      }),
    )
    .handler(async ({ context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      const [
        revenueResult,
        expensesResult,
        customerPaymentsResult,
        vendorPaymentsResult,
        outstandingInvoicesResult,
      ] = await Promise.all([
        db
          .select({
            total: sql<number>`COALESCE(SUM(${event.totalRevenue}), 0)`,
          })
          .from(event)
          .where(inArray(event.createdBy, scopedUserIds)),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${expense.amount}), 0)`,
          })
          .from(expense)
          .innerJoin(event, eq(expense.eventId, event.id))
          .where(inArray(event.createdBy, scopedUserIds)),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${payment.amount}), 0)`,
          })
          .from(payment)
          .innerJoin(event, eq(payment.eventId, event.id))
          .where(
            and(
              sql`${payment.type} IN ('customer_advance', 'customer_payment')`,
              inArray(event.createdBy, scopedUserIds),
            ),
          ),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${payment.amount}), 0)`,
          })
          .from(payment)
          .innerJoin(event, eq(payment.eventId, event.id))
          .where(
            and(
              eq(payment.type, "vendor_payment"),
              inArray(event.createdBy, scopedUserIds),
            ),
          ),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${invoice.amount}), 0)`,
          })
          .from(invoice)
          .innerJoin(event, eq(invoice.eventId, event.id))
          .where(
            and(
              sql`${invoice.status} NOT IN ('paid', 'draft')`,
              inArray(event.createdBy, scopedUserIds),
            ),
          ),
      ]);

      return {
        totalRevenue: Number(revenueResult[0]?.total ?? 0),
        totalExpenses: Number(expensesResult[0]?.total ?? 0),
        totalCustomerPayments: Number(customerPaymentsResult[0]?.total ?? 0),
        totalVendorPayments: Number(vendorPaymentsResult[0]?.total ?? 0),
        outstandingInvoices: Number(outstandingInvoicesResult[0]?.total ?? 0),
      };
    }),

  getUpcomingEvents: protectedProcedure
    .route({
      tags: ["Dashboard"],
      summary: "Get upcoming events",
      description: "Fetch the next N upcoming events ordered by start date.",
    })
    .input(
      z.object({
        limit: z.number().int().min(1).max(20).default(5),
      }),
    )
    .output(z.array(eventSchema))
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      const events = await db.query.event.findMany({
        where: and(
          eq(event.status, "upcoming"),
          inArray(event.createdBy, scopedUserIds),
        ),
        orderBy: [event.startDate],
        limit: input.limit,
      });

      return events;
    }),

  getRecentActivity: protectedProcedure
    .route({
      tags: ["Dashboard"],
      summary: "Get recent activity",
      description:
        "Fetch the most recent payment activity across all events.",
    })
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .output(z.array(paymentWithEventSchema))
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const scopedEvents = await db
        .select({ id: event.id })
        .from(event)
        .where(inArray(event.createdBy, scopedUserIds));
      const scopedEventIds = scopedEvents.map((row) => row.id);

      if (scopedEventIds.length === 0) {
        return [];
      }

      const payments = await db.query.payment.findMany({
        where: inArray(payment.eventId, scopedEventIds),
        orderBy: desc(payment.paymentDate),
        limit: input.limit,
        with: {
          event: true,
        },
      });

      return payments;
    }),
};
