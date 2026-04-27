import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, desc, count, sql, inArray } from "@se-project/db";
import { expense, vendor } from "@se-project/db/schema/finance";
import { event } from "@se-project/db/schema/events";
import { protectedProcedure, eventHeadProcedure } from "../index";
import {
  expenseSchema,
  expenseWithVendorSchema,
} from "../schemas";
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

export const expensesRouter = {
  create: eventHeadProcedure
    .route({
      tags: ["Expenses"],
      summary: "Create expense",
      description:
        "Record a new expense against an event. Optionally link to a vendor. Requires event head role.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        category: z.enum([
          "salary",
          "food",
          "transportation",
          "equipment_repair",
          "miscellaneous",
        ]),
        amount: z.number().int().min(1),
        description: z.string().optional(),
        vendorId: z.uuid().optional(),
      }),
    )
    .output(expenseSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const scopedEvents = await db
        .select({ id: event.id })
        .from(event)
        .where(inArray(event.createdBy, scopedUserIds));
      const scopedEventIds = scopedEvents.map((row) => row.id);

      if (!scopedEventIds.includes(input.eventId)) {
        throw new ORPCError("FORBIDDEN", {
          message: "You do not have access to this event",
        });
      }

      if (input.vendorId) {
        const vendorExists = await db.query.vendor.findFirst({
          where: eq(vendor.id, input.vendorId),
        });
        if (!vendorExists) {
          throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
        }
      }

      const [created] = await db
        .insert(expense)
        .values({
          ...input,
          createdBy: userId,
        })
        .returning();

      return created!;
    }),

  list: protectedProcedure
    .route({
      tags: ["Expenses"],
      summary: "List expenses",
      description:
        "Returns a paginated list of expenses for an event, including vendor details. Filter by category.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        category: z
          .enum([
            "salary",
            "food",
            "transportation",
            "equipment_repair",
            "miscellaneous",
          ])
          .optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(z.object({ expenses: z.array(expenseWithVendorSchema), total: z.number().int() }))
    .handler(async ({ input, context }) => {
      const { eventId, category, page, limit } = input;
      const offset = (page - 1) * limit;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const scopedEvents = await db
        .select({ id: event.id })
        .from(event)
        .where(inArray(event.createdBy, scopedUserIds));
      const scopedEventIds = scopedEvents.map((row) => row.id);

      if (!scopedEventIds.includes(eventId)) {
        return {
          expenses: [],
          total: 0,
        };
      }

      const conditions = [eq(expense.eventId, eventId)];

      if (category) {
        conditions.push(eq(expense.category, category));
      }

      const where = and(...conditions);

      const [expenses, totalResult] = await Promise.all([
        db.query.expense.findMany({
          where,
          orderBy: desc(expense.createdAt),
          limit,
          offset,
          with: {
            vendor: true,
          },
        }),
        db
          .select({ total: count() })
          .from(expense)
          .where(where),
      ]);

      return {
        expenses,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  update: eventHeadProcedure
    .route({
      tags: ["Expenses"],
      summary: "Update expense",
      description:
        "Update an expense record. Validates the vendor if provided. Requires event head role.",
    })
    .input(
      z.object({
        id: z.uuid(),
        category: z
          .enum([
            "salary",
            "food",
            "transportation",
            "equipment_repair",
            "miscellaneous",
          ])
          .optional(),
        amount: z.number().int().min(1).optional(),
        description: z.string().optional(),
        vendorId: z.uuid().nullable().optional(),
      }),
    )
    .output(expenseSchema)
    .handler(async ({ input, context }) => {
      const { id, ...data } = input;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const scopedEvents = await db
        .select({ id: event.id })
        .from(event)
        .where(inArray(event.createdBy, scopedUserIds));
      const scopedEventIds = scopedEvents.map((row) => row.id);

      const existing = await db.query.expense.findFirst({
        where: and(
          eq(expense.id, id),
          inArray(expense.eventId, scopedEventIds),
        ),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
      }

      if (data.vendorId) {
        const vendorExists = await db.query.vendor.findFirst({
          where: eq(vendor.id, data.vendorId),
        });
        if (!vendorExists) {
          throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
        }
      }

      const [updated] = await db
        .update(expense)
        .set(data)
        .where(
          and(
            eq(expense.id, id),
            inArray(expense.eventId, scopedEventIds),
          ),
        )
        .returning();

      return updated!;
    }),

  delete: eventHeadProcedure
    .route({
      tags: ["Expenses"],
      summary: "Delete expense",
      description: "Delete an expense record. Requires event head role.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const scopedEvents = await db
        .select({ id: event.id })
        .from(event)
        .where(inArray(event.createdBy, scopedUserIds));
      const scopedEventIds = scopedEvents.map((row) => row.id);

      const existing = await db.query.expense.findFirst({
        where: and(
          eq(expense.id, input.id),
          inArray(expense.eventId, scopedEventIds),
        ),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
      }

      await db
        .delete(expense)
        .where(
          and(
            eq(expense.id, input.id),
            inArray(expense.eventId, scopedEventIds),
          ),
        );

      return { success: true };
    }),

  getEventExpenseSummary: protectedProcedure
    .route({
      tags: ["Expenses"],
      summary: "Get expense summary for event",
      description:
        "Get the total expenses for an event along with a breakdown by category.",
    })
    .input(z.object({ eventId: z.uuid() }))
    .output(
      z.object({
        total: z.number(),
        byCategory: z.array(
          z.object({
            category: z.enum([
              "salary",
              "food",
              "transportation",
              "equipment_repair",
              "miscellaneous",
            ]),
            total: z.number(),
          }),
        ),
      }),
    )
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const scopedEvents = await db
        .select({ id: event.id })
        .from(event)
        .where(inArray(event.createdBy, scopedUserIds));
      const scopedEventIds = scopedEvents.map((row) => row.id);

      if (!scopedEventIds.includes(input.eventId)) {
        return {
          total: 0,
          byCategory: [],
        };
      }

      const [totalResult] = await db
        .select({
          total: sql<number>`coalesce(sum(${expense.amount}), 0)`,
        })
        .from(expense)
        .where(eq(expense.eventId, input.eventId));

      const byCategoryResult = await db
        .select({
          category: expense.category,
          total: sql<number>`coalesce(sum(${expense.amount}), 0)`,
        })
        .from(expense)
        .where(eq(expense.eventId, input.eventId))
        .groupBy(expense.category);

      return {
        total: Number(totalResult?.total ?? 0),
        byCategory: byCategoryResult.map((row) => ({
          category: row.category,
          total: Number(row.total),
        })),
      };
    }),
};
