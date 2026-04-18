import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, desc, count, sql } from "@se-project/db";
import { payment, invoice } from "@se-project/db/schema/finance";
import { protectedProcedure, eventHeadProcedure } from "../index";
import {
  paymentSchema,
  paymentWithRelationsSchema,
} from "../schemas";

export const paymentsRouter = {
  recordPayment: eventHeadProcedure
    .route({
      tags: ["Payments"],
      summary: "Record payment",
      description:
        "Record a customer or vendor payment. Automatically updates the linked invoice status to 'paid' or 'partial' based on total amount received. Requires event head role.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        invoiceId: z.uuid().optional(),
        vendorId: z.uuid().optional(),
        amount: z.number().int().min(1),
        paymentDate: z.coerce.date(),
        paymentMethod: z.string().optional(),
        type: z.enum(["customer_advance", "customer_payment", "vendor_payment"]),
        notes: z.string().optional(),
      }),
    )
    .output(paymentSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      if (input.invoiceId) {
        const existingInvoice = await db.query.invoice.findFirst({
          where: eq(invoice.id, input.invoiceId),
        });
        if (!existingInvoice) {
          throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
        }
      }

      const [created] = await db
        .insert(payment)
        .values({
          ...input,
          recordedBy: userId,
        })
        .returning();

      if (input.invoiceId) {
        const [totalPaidResult] = await db
          .select({
            totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)`,
          })
          .from(payment)
          .where(eq(payment.invoiceId, input.invoiceId));

        const totalPaid = Number(totalPaidResult?.totalPaid ?? 0);

        const inv = await db.query.invoice.findFirst({
          where: eq(invoice.id, input.invoiceId),
        });

        if (inv) {
          const newStatus = totalPaid >= inv.amount ? "paid" : "partial";
          await db
            .update(invoice)
            .set({ status: newStatus })
            .where(eq(invoice.id, input.invoiceId));
        }
      }

      return created!;
    }),

  list: protectedProcedure
    .route({
      tags: ["Payments"],
      summary: "List payments",
      description:
        "Returns a paginated list of payments with related event, invoice, and vendor details.",
    })
    .input(
      z.object({
        eventId: z.uuid().optional(),
        invoiceId: z.uuid().optional(),
        vendorId: z.uuid().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        payments: z.array(paymentWithRelationsSchema),
        total: z.number().int(),
      }),
    )
    .handler(async ({ input }) => {
      const { eventId, invoiceId, vendorId, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (eventId) {
        conditions.push(eq(payment.eventId, eventId));
      }

      if (invoiceId) {
        conditions.push(eq(payment.invoiceId, invoiceId));
      }

      if (vendorId) {
        conditions.push(eq(payment.vendorId, vendorId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [payments, totalResult] = await Promise.all([
        db.query.payment.findMany({
          where,
          orderBy: desc(payment.paymentDate),
          limit,
          offset,
          with: {
            event: true,
            invoice: true,
            vendor: true,
          },
        }),
        db
          .select({ total: count() })
          .from(payment)
          .where(where ?? undefined),
      ]);

      return {
        payments,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  getEventBalance: protectedProcedure
    .route({
      tags: ["Payments"],
      summary: "Get event balance",
      description:
        "Calculate the financial balance for an event — total invoiced amount, total customer payments received, and outstanding balance.",
    })
    .input(z.object({ eventId: z.uuid() }))
    .output(
      z.object({
        totalDue: z.number(),
        totalPaid: z.number(),
        balance: z.number(),
      }),
    )
    .handler(async ({ input }) => {
      const [totalDueResult] = await db
        .select({
          totalDue: sql<number>`coalesce(sum(${invoice.amount}), 0)`,
        })
        .from(invoice)
        .where(eq(invoice.eventId, input.eventId));

      const [totalPaidResult] = await db
        .select({
          totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)`,
        })
        .from(payment)
        .where(
          and(
            eq(payment.eventId, input.eventId),
            sql`${payment.type} in ('customer_advance', 'customer_payment')`,
          ),
        );

      const totalDue = Number(totalDueResult?.totalDue ?? 0);
      const totalPaid = Number(totalPaidResult?.totalPaid ?? 0);

      return {
        totalDue,
        totalPaid,
        balance: totalDue - totalPaid,
      };
    }),
};
