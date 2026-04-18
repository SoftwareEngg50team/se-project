import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, sql, desc, or, count } from "@se-project/db";
import { event } from "@se-project/db/schema/events";
import { expense } from "@se-project/db/schema/finance";
import {
  protectedProcedure,
  eventHeadProcedure,
  ownerProcedure,
} from "../index";
import {
  eventSchema,
  eventWithCreatorSchema,
} from "../schemas";

export const eventsRouter = {
  list: protectedProcedure
    .route({
      tags: ["Events"],
      summary: "List events",
      description:
        "Returns a paginated list of events. Filter by status or search by event name and client name.",
    })
    .input(
      z.object({
        status: z
          .enum(["upcoming", "in_progress", "completed", "cancelled"])
          .optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        events: z.array(eventSchema),
        total: z.number().int(),
      }),
    )
    .handler(async ({ input }) => {
      const { status, search, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (status) {
        conditions.push(eq(event.status, status));
      }

      if (search) {
        conditions.push(
          or(
            ilike(event.name, `%${search}%`),
            ilike(event.clientName, `%${search}%`),
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [events, totalResult] = await Promise.all([
        db.query.event.findMany({
          where,
          orderBy: desc(event.startDate),
          limit,
          offset,
        }),
        db
          .select({ total: count() })
          .from(event)
          .where(where ?? undefined),
      ]);

      return {
        events,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  getById: protectedProcedure
    .route({
      tags: ["Events"],
      summary: "Get event by ID",
      description: "Fetch a single event along with its creator details.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(eventWithCreatorSchema)
    .handler(async ({ input }) => {
      const result = await db.query.event.findFirst({
        where: eq(event.id, input.id),
        with: {
          creator: true,
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      return result;
    }),

  create: eventHeadProcedure
    .route({
      tags: ["Events"],
      summary: "Create event",
      description: "Create a new event. Requires event head or owner role.",
    })
    .input(
      z.object({
        name: z.string().min(1),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        location: z.string().min(1),
        clientName: z.string().min(1),
        clientPhone: z.string().optional(),
        clientEmail: z.email().optional(),
        notes: z.string().optional(),
        totalRevenue: z.number().int().optional(),
      }),
    )
    .output(eventSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const [created] = await db
        .insert(event)
        .values({
          ...input,
          createdBy: userId,
        })
        .returning();

      return created!;
    }),

  update: eventHeadProcedure
    .route({
      tags: ["Events"],
      summary: "Update event",
      description: "Update event details. Only provided fields are changed.",
    })
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        location: z.string().min(1).optional(),
        clientName: z.string().min(1).optional(),
        clientPhone: z.string().optional(),
        clientEmail: z.email().optional(),
        notes: z.string().optional(),
        totalRevenue: z.number().int().optional(),
      }),
    )
    .output(eventSchema)
    .handler(async ({ input }) => {
      const { id, ...data } = input;

      const existing = await db.query.event.findFirst({
        where: eq(event.id, id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const [updated] = await db
        .update(event)
        .set(data)
        .where(eq(event.id, id))
        .returning();

      return updated!;
    }),

  updateStatus: eventHeadProcedure
    .route({
      tags: ["Events"],
      summary: "Update event status",
      description: "Change the lifecycle status of an event.",
    })
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(["upcoming", "in_progress", "completed", "cancelled"]),
      }),
    )
    .output(eventSchema)
    .handler(async ({ input }) => {
      const existing = await db.query.event.findFirst({
        where: eq(event.id, input.id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const [updated] = await db
        .update(event)
        .set({ status: input.status })
        .where(eq(event.id, input.id))
        .returning();

      return updated!;
    }),

  delete: ownerProcedure
    .route({
      tags: ["Events"],
      summary: "Delete event",
      description: "Permanently delete an event. Restricted to owners only.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.literal(true) }))
    .handler(async ({ input }) => {
      const existing = await db.query.event.findFirst({
        where: eq(event.id, input.id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      await db.delete(event).where(eq(event.id, input.id));

      return { success: true };
    }),

  getEventSummary: protectedProcedure
    .route({
      tags: ["Events"],
      summary: "Get event summary",
      description:
        "Fetch an event with aggregated expense totals and calculated profit.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(
      z.object({
        event: eventWithCreatorSchema,
        totalExpenses: z.number(),
        profit: z.number(),
      }),
    )
    .handler(async ({ input }) => {
      const eventData = await db.query.event.findFirst({
        where: eq(event.id, input.id),
        with: {
          creator: true,
        },
      });

      if (!eventData) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const [expenseResult] = await db
        .select({ total: sql<number>`coalesce(sum(${expense.amount}), 0)` })
        .from(expense)
        .where(eq(expense.eventId, input.id));

      const totalExpenses = Number(expenseResult?.total ?? 0);
      const profit = (eventData.totalRevenue ?? 0) - totalExpenses;

      return {
        event: eventData,
        totalExpenses,
        profit,
      };
    }),
};
