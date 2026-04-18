import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, desc, count, sql } from "@se-project/db";
import { event } from "@se-project/db/schema/events";
import { invoice, invoiceLineItem } from "@se-project/db/schema/finance";
import { protectedProcedure, eventHeadProcedure } from "../index";
import {
  invoiceSchema,
  invoiceWithRelationsSchema,
  invoiceDetailSchema,
} from "../schemas";

const invoiceLineItemInputSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().int().min(1),
  serviceDate: z.coerce.date().optional(),
});

function normalizeLineItems(
  items: z.infer<typeof invoiceLineItemInputSchema>[],
) {
  return items.map((item, index) => ({
    description: item.description.trim(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    serviceDate: item.serviceDate,
    sortOrder: index,
  }));
}

function calculateInvoiceAmount(
  items: ReturnType<typeof normalizeLineItems>,
) {
  return items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
}

function buildFallbackLineItem(
  description: string,
  amount: number,
) {
  return normalizeLineItems([
    {
      description,
      quantity: 1,
      unitPrice: amount,
    },
  ]);
}

function sortInvoiceCollections<T extends {
  lineItems: Array<{ sortOrder: number }>;
  payments: Array<{ paymentDate: Date }>;
}>(record: T) {
  return {
    ...record,
    lineItems: [...record.lineItems].sort((a, b) => a.sortOrder - b.sortOrder),
    payments: [...record.payments].sort(
      (a, b) =>
        new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
    ),
  };
}

export const invoicesRouter = {
  create: eventHeadProcedure
    .route({
      tags: ["Invoices"],
      summary: "Create invoice",
      description:
        "Create a new invoice for an event. Invoice number is auto-generated. Requires event head role.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        amount: z.number().int().min(1).optional(),
        dueDate: z.coerce.date(),
        lineItems: z.array(invoiceLineItemInputSchema).min(1).max(25).optional(),
      }).refine(
        (value) => value.amount !== undefined || value.lineItems !== undefined,
        {
          message: "Provide an amount or at least one invoice line item",
          path: ["amount"],
        },
      ),
    )
    .output(invoiceSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const eventRecord = await db.query.event.findFirst({
        where: eq(event.id, input.eventId),
      });

      if (!eventRecord) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const invoiceNumber = `INV-${Date.now()}`;
      const preparedLineItems = input.lineItems
        ? normalizeLineItems(input.lineItems)
        : buildFallbackLineItem(
            `Event services - ${eventRecord.name}`,
            input.amount!,
          );
      const totalAmount = calculateInvoiceAmount(preparedLineItems);

      const created = await db.transaction(async (tx) => {
        const [createdInvoice] = await tx
          .insert(invoice)
          .values({
            eventId: input.eventId,
            amount: totalAmount,
            dueDate: input.dueDate,
            invoiceNumber,
            createdBy: userId,
          })
          .returning();

        await tx.insert(invoiceLineItem).values(
          preparedLineItems.map((item) => ({
            invoiceId: createdInvoice!.id,
            ...item,
          })),
        );

        return createdInvoice!;
      });

      return created;
    }),

  list: protectedProcedure
    .route({
      tags: ["Invoices"],
      summary: "List invoices",
      description:
        "Returns a paginated list of invoices. Filter by event, status, or overdue threshold.",
    })
    .input(
      z.object({
        eventId: z.uuid().optional(),
        status: z
          .enum(["draft", "sent", "partial", "paid", "overdue"])
          .optional(),
        overdueDays: z.number().int().min(1).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        invoices: z.array(invoiceWithRelationsSchema),
        total: z.number().int(),
      }),
    )
    .handler(async ({ input }) => {
      const { eventId, status, overdueDays, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (eventId) {
        conditions.push(eq(invoice.eventId, eventId));
      }

      if (status) {
        conditions.push(eq(invoice.status, status));
      }

      if (overdueDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - overdueDays);
        conditions.push(
          sql`${invoice.dueDate} < ${cutoffDate}`,
        );
        conditions.push(
          sql`${invoice.status} != 'paid'`,
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [invoices, totalResult] = await Promise.all([
        db.query.invoice.findMany({
          where,
          orderBy: desc(invoice.issuedAt),
          limit,
          offset,
          with: {
            event: true,
            lineItems: true,
            payments: true,
          },
        }),
        db
          .select({ total: count() })
          .from(invoice)
          .where(where ?? undefined),
      ]);

      return {
        invoices: invoices.map(sortInvoiceCollections),
        total: totalResult[0]?.total ?? 0,
      };
    }),

  getById: protectedProcedure
    .route({
      tags: ["Invoices"],
      summary: "Get invoice by ID",
      description:
        "Fetch an invoice with its associated event, payment history, and creator.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(invoiceDetailSchema)
    .handler(async ({ input }) => {
      const result = await db.query.invoice.findFirst({
        where: eq(invoice.id, input.id),
        with: {
          event: true,
          lineItems: true,
          payments: true,
          creator: true,
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
      }

      return sortInvoiceCollections(result);
    }),

  update: eventHeadProcedure
    .route({
      tags: ["Invoices"],
      summary: "Update invoice",
      description:
        "Update invoice status, amount, or due date. Requires event head role.",
    })
    .input(
      z.object({
        id: z.uuid(),
        status: z
          .enum(["draft", "sent", "partial", "paid", "overdue"])
          .optional(),
        amount: z.number().int().min(1).optional(),
        dueDate: z.coerce.date().optional(),
        lineItems: z.array(invoiceLineItemInputSchema).min(1).max(25).optional(),
      }),
    )
    .output(invoiceSchema)
    .handler(async ({ input }) => {
      const { id, amount, lineItems, ...data } = input;

      const existing = await db.query.invoice.findFirst({
        where: eq(invoice.id, id),
        with: {
          event: true,
          lineItems: true,
        },
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
      }

      let nextLineItems: ReturnType<typeof normalizeLineItems> | undefined;

      if (lineItems) {
        nextLineItems = normalizeLineItems(lineItems);
      } else if (amount !== undefined) {
        if (existing.lineItems.length > 1) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Update line items explicitly when changing the amount on an itemized invoice",
          });
        }

        nextLineItems = buildFallbackLineItem(
          existing.lineItems[0]?.description ?? `Event services - ${existing.event.name}`,
          amount,
        );
      }

      const updated = await db.transaction(async (tx) => {
        const [updatedInvoice] = await tx
          .update(invoice)
          .set({
            ...data,
            ...(nextLineItems
              ? { amount: calculateInvoiceAmount(nextLineItems) }
              : amount !== undefined
                ? { amount }
                : {}),
          })
          .where(eq(invoice.id, id))
          .returning();

        if (nextLineItems) {
          await tx.delete(invoiceLineItem).where(eq(invoiceLineItem.invoiceId, id));
          await tx.insert(invoiceLineItem).values(
            nextLineItems.map((item) => ({
              invoiceId: id,
              ...item,
            })),
          );
        }

        return updatedInvoice!;
      });

      return updated;
    }),

  getOverdue: protectedProcedure
    .route({
      tags: ["Invoices"],
      summary: "Get overdue invoices",
      description:
        "Fetch all unpaid invoices that are overdue by at least the specified number of days.",
    })
    .input(
      z.object({
        days: z.number().int().min(1).default(15),
      }),
    )
    .output(z.array(invoiceWithRelationsSchema))
    .handler(async ({ input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.days);

      const overdueInvoices = await db.query.invoice.findMany({
        where: and(
          sql`${invoice.dueDate} < ${cutoffDate}`,
          sql`${invoice.status} != 'paid'`,
        ),
        orderBy: desc(invoice.dueDate),
        with: {
          event: true,
          lineItems: true,
          payments: true,
        },
      });

      return overdueInvoices.map(sortInvoiceCollections);
    }),
};
