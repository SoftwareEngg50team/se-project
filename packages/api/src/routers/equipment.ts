import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, desc, count, inArray, or, sql } from "@se-project/db";
import {
  equipmentItem,
  equipmentCategory,
  equipmentAssignment,
} from "@se-project/db/schema/equipment";
import { event } from "@se-project/db/schema/events";
import {
  protectedProcedure,
  eventHeadProcedure,
} from "../index";
import {
  equipmentItemSchema,
  equipmentCategorySchema,
  equipmentItemWithCategorySchema,
  equipmentCategoryWithItemsSchema,
  equipmentItemDetailSchema,
} from "../schemas";
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

const equipmentStatusSchema = equipmentItemSchema.shape.status;

const defaultEquipmentCategories: Array<{ name: string; description: string }> = [
  { name: "Speakers", description: "Passive and active PA speakers for events" },
  { name: "Subwoofers", description: "Low-frequency subwoofer systems" },
  { name: "Amplifiers", description: "Power amplifiers and rack amps" },
  { name: "Mixers", description: "Analog and digital audio mixing consoles" },
  { name: "Microphones", description: "Wired and wireless microphones" },
  { name: "DI Boxes", description: "Direct input boxes and signal interfaces" },
  { name: "Stage Lights", description: "LED par cans, spotlights, and wash lights" },
  { name: "Moving Heads", description: "Intelligent moving head fixtures" },
  { name: "Lighting Controllers", description: "DMX controllers and lighting desks" },
  { name: "DMX Accessories", description: "DMX splitters, cables, and terminators" },
  { name: "Trusses", description: "Aluminum truss sections and rigging hardware" },
  { name: "Generators", description: "Portable power generators and backup units" },
  { name: "Power Distribution", description: "Distribution boxes, extension reels, and connectors" },
  { name: "LED Walls", description: "LED panel modules and processors" },
  { name: "Projectors", description: "Projectors, lenses, and projection accessories" },
];

async function resolveScopedLinkedEquipmentIds(scopedUserIds: string[]) {
  const scopedEvents = await db
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.createdBy, scopedUserIds));
  const scopedEventIds = scopedEvents.map((row) => row.id);

  if (scopedEventIds.length === 0) {
    return [] as string[];
  }

  const scopedAssignments = await db
    .select({ id: equipmentAssignment.equipmentId })
    .from(equipmentAssignment)
    .where(inArray(equipmentAssignment.eventId, scopedEventIds));

  return Array.from(new Set(scopedAssignments.map((row) => row.id)));
}

export const equipmentRouter = {
  list: protectedProcedure
    .route({
      tags: ["Equipment"],
      summary: "List equipment items",
      description:
        "Returns a paginated list of equipment items with their categories. Filter by status, category, or search by name.",
    })
    .input(
      z.object({
        status: equipmentStatusSchema.optional(),
        categoryId: z.uuid().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        items: z.array(equipmentItemWithCategorySchema),
        total: z.number().int(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { status, categoryId, search, page, limit } = input;
      const offset = (page - 1) * limit;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedEquipmentIds = await resolveScopedLinkedEquipmentIds(scopedUserIds);

      const where = and(
        or(
          inArray(equipmentItem.createdBy, scopedUserIds),
          linkedEquipmentIds.length > 0
            ? inArray(equipmentItem.id, linkedEquipmentIds)
            : undefined,
        ),
        status ? eq(equipmentItem.status, status) : undefined,
        categoryId ? eq(equipmentItem.categoryId, categoryId) : undefined,
        search ? ilike(equipmentItem.name, `%${search}%`) : undefined,
      );

      const [items, totalResult] = await Promise.all([
        db.query.equipmentItem.findMany({
          where,
          orderBy: desc(equipmentItem.createdAt),
          limit,
          offset,
          with: {
            category: true,
          },
        }),
        db
          .select({ total: count() })
          .from(equipmentItem)
          .where(where ?? undefined),
      ]);

      return {
        items,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  getById: protectedProcedure
    .route({
      tags: ["Equipment"],
      summary: "Get equipment item",
      description:
        "Fetch a single equipment item with its category and assignment history.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(equipmentItemDetailSchema)
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedEquipmentIds = await resolveScopedLinkedEquipmentIds(scopedUserIds);

      const result = await db.query.equipmentItem.findFirst({
        where: and(
          eq(equipmentItem.id, input.id),
          or(
            inArray(equipmentItem.createdBy, scopedUserIds),
            linkedEquipmentIds.length > 0
              ? inArray(equipmentItem.id, linkedEquipmentIds)
              : undefined,
          ),
        ),
        with: {
          category: true,
          assignments: {
            with: {
              event: true,
              assignedByUser: true,
            },
          },
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", {
          message: "Equipment item not found",
        });
      }

      return result;
    }),

  create: eventHeadProcedure
    .route({
      tags: ["Equipment"],
      summary: "Create equipment item",
      description:
        "Add a new piece of equipment to a category. Requires event head role.",
    })
    .input(
      z.object({
        name: z.string().min(1),
        categoryId: z.uuid(),
        status: equipmentStatusSchema.default("available"),
        purchaseDate: z.coerce.date().optional(),
        purchaseCost: z.number().int().optional(),
        notes: z.string().optional(),
      }),
    )
    .output(equipmentItemSchema)
    .handler(async ({ input, context }) => {
      const category = await db.query.equipmentCategory.findFirst({
        where: eq(equipmentCategory.id, input.categoryId),
      });

      if (!category) {
        throw new ORPCError("NOT_FOUND", {
          message: "Category not found",
        });
      }

      const [created] = await db
        .insert(equipmentItem)
        .values({
          ...input,
          createdBy: context.session.user.id,
        })
        .returning();

      return created!;
    }),

  update: eventHeadProcedure
    .route({
      tags: ["Equipment"],
      summary: "Update equipment item",
      description: "Update equipment details. Validates category if provided.",
    })
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).optional(),
        categoryId: z.uuid().optional(),
        status: equipmentStatusSchema.optional(),
        purchaseDate: z.coerce.date().optional(),
        purchaseCost: z.number().int().optional(),
        notes: z.string().optional(),
      }),
    )
    .output(equipmentItemSchema)
    .handler(async ({ input, context }) => {
      const { id, ...data } = input;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedEquipmentIds = await resolveScopedLinkedEquipmentIds(scopedUserIds);

      const existing = await db.query.equipmentItem.findFirst({
        where: and(
          eq(equipmentItem.id, id),
          or(
            inArray(equipmentItem.createdBy, scopedUserIds),
            linkedEquipmentIds.length > 0
              ? inArray(equipmentItem.id, linkedEquipmentIds)
              : undefined,
          ),
        ),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Equipment item not found",
        });
      }

      if (data.categoryId) {
        const category = await db.query.equipmentCategory.findFirst({
          where: eq(equipmentCategory.id, data.categoryId),
        });

        if (!category) {
          throw new ORPCError("NOT_FOUND", {
            message: "Category not found",
          });
        }
      }

      const [updated] = await db
        .update(equipmentItem)
        .set(data)
        .where(
          and(
            eq(equipmentItem.id, id),
            or(
              inArray(equipmentItem.createdBy, scopedUserIds),
              linkedEquipmentIds.length > 0
                ? inArray(equipmentItem.id, linkedEquipmentIds)
                : undefined,
            ),
          ),
        )
        .returning();

      return updated!;
    }),

  updateStatus: eventHeadProcedure
    .route({
      tags: ["Equipment"],
      summary: "Update equipment status",
      description: "Change the operational status of an equipment item.",
    })
    .input(
      z.object({
        id: z.uuid(),
        status: equipmentStatusSchema,
      }),
    )
    .output(equipmentItemSchema)
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedEquipmentIds = await resolveScopedLinkedEquipmentIds(scopedUserIds);

      const existing = await db.query.equipmentItem.findFirst({
        where: and(
          eq(equipmentItem.id, input.id),
          or(
            inArray(equipmentItem.createdBy, scopedUserIds),
            linkedEquipmentIds.length > 0
              ? inArray(equipmentItem.id, linkedEquipmentIds)
              : undefined,
          ),
        ),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Equipment item not found",
        });
      }

      const [updated] = await db
        .update(equipmentItem)
        .set({ status: input.status })
        .where(
          and(
            eq(equipmentItem.id, input.id),
            or(
              inArray(equipmentItem.createdBy, scopedUserIds),
              linkedEquipmentIds.length > 0
                ? inArray(equipmentItem.id, linkedEquipmentIds)
                : undefined,
            ),
          ),
        )
        .returning();

      return updated!;
    }),

  listCategories: protectedProcedure
    .route({
      tags: ["Equipment"],
      summary: "List equipment categories",
      description:
        "Fetch all equipment categories with their associated items.",
    })
    .output(z.array(equipmentCategoryWithItemsSchema))
    .handler(async () => {
      await db
        .insert(equipmentCategory)
        .values(defaultEquipmentCategories)
        .onConflictDoNothing();

      const categories = await db.query.equipmentCategory.findMany({
        with: {
          items: true,
        },
      });

      return categories;
    }),

  createCategory: eventHeadProcedure
    .route({
      tags: ["Equipment"],
      summary: "Create equipment category",
      description: "Add a new equipment category. Requires event head role.",
    })
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .output(equipmentCategorySchema)
    .handler(async ({ input }) => {
      const [created] = await db
        .insert(equipmentCategory)
        .values(input)
        .returning();

      return created!;
    }),

  getMonthlyUtilization: protectedProcedure
    .route({
      tags: ["Equipment"],
      summary: "Get monthly equipment utilization",
      description:
        "Returns utilization metrics per month based on equipment assignments for scoped events.",
    })
    .input(
      z.object({
        months: z.number().int().min(1).max(24).default(6),
      }),
    )
    .output(
      z.array(
        z.object({
          monthKey: z.string(),
          monthLabel: z.string(),
          assignmentCount: z.number().int(),
          uniqueEquipmentCount: z.number().int(),
          utilizationRate: z.number(),
        }),
      ),
    )
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedEquipmentIds = await resolveScopedLinkedEquipmentIds(scopedUserIds);

      const allEquipment = await db.query.equipmentItem.findMany({
        where: or(
          inArray(equipmentItem.createdBy, scopedUserIds),
          linkedEquipmentIds.length > 0
            ? inArray(equipmentItem.id, linkedEquipmentIds)
            : undefined,
        ),
      });

      const totalEquipment = allEquipment.length;
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth() - (input.months - 1), 1);

      const assignments = await db.query.equipmentAssignment.findMany({
        with: {
          event: true,
        },
      });

      const scopedAssignments = assignments.filter(
        (assignment) =>
          scopedUserIds.includes(assignment.event.createdBy) &&
          assignment.event.startDate >= start,
      );

      const monthBuckets = new Map<
        string,
        { monthLabel: string; assignmentCount: number; equipmentSet: Set<string> }
      >();

      for (let i = 0; i < input.months; i += 1) {
        const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = monthDate.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        });

        monthBuckets.set(monthKey, {
          monthLabel,
          assignmentCount: 0,
          equipmentSet: new Set<string>(),
        });
      }

      for (const assignment of scopedAssignments) {
        const date = new Date(assignment.event.startDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const bucket = monthBuckets.get(monthKey);

        if (!bucket) {
          continue;
        }

        bucket.assignmentCount += 1;
        bucket.equipmentSet.add(assignment.equipmentId);
      }

      return Array.from(monthBuckets.entries()).map(([monthKey, bucket]) => {
        const uniqueEquipmentCount = bucket.equipmentSet.size;
        const utilizationRate =
          totalEquipment <= 0 ? 0 : Number(((uniqueEquipmentCount / totalEquipment) * 100).toFixed(2));

        return {
          monthKey,
          monthLabel: bucket.monthLabel,
          assignmentCount: bucket.assignmentCount,
          uniqueEquipmentCount,
          utilizationRate,
        };
      });
    }),

  getAvailableByDateRange: protectedProcedure
    .route({
      tags: ["Equipment"],
      summary: "Get equipment available for specific date range",
      description:
        "Check which equipment items are available (not assigned) during a specific event date range. Helps prevent double-booking.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        categoryId: z.uuid().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        items: z.array(
          equipmentItemWithCategorySchema.extend({
            conflictingEvents: z.array(z.object({
              eventId: z.string().uuid(),
              eventName: z.string(),
              startDate: z.date(),
              endDate: z.date(),
            })),
          }),
        ),
        total: z.number().int(),
        unavailableCount: z.number().int(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      
      // Get the event to check date range
      const eventRecord = await db.query.event.findFirst({
        where: and(
          eq(event.id, input.eventId),
          inArray(event.createdBy, scopedUserIds),
        ),
      });

      if (!eventRecord) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const offset = (input.page - 1) * input.limit;
      const linkedEquipmentIds = await resolveScopedLinkedEquipmentIds(scopedUserIds);

      // Get all equipment items
      const allEquipment = await db.query.equipmentItem.findMany({
        where: and(
          or(
            inArray(equipmentItem.createdBy, scopedUserIds),
            linkedEquipmentIds.length > 0
              ? inArray(equipmentItem.id, linkedEquipmentIds)
              : undefined,
          ),
          input.categoryId ? eq(equipmentItem.categoryId, input.categoryId) : undefined,
        ),
        with: {
          category: true,
          assignments: {
            with: {
              event: true,
            },
          },
        },
      });

      // Check for overlapping assignments
      const itemsWithConflicts = allEquipment.map((item) => {
        const conflictingEvents = item.assignments
          .filter((assignment) => {
            // Filter out returns
            if (assignment.returnedAt) return false;
            
            // Check for date overlap
            const assignedStart = new Date(assignment.event.startDate);
            const assignedEnd = new Date(assignment.event.endDate);
            const eventStart = new Date(eventRecord.startDate);
            const eventEnd = new Date(eventRecord.endDate);

            return !(eventEnd < assignedStart || eventStart > assignedEnd);
          })
          .map((assignment) => ({
            eventId: assignment.event.id,
            eventName: assignment.event.name,
            startDate: assignment.event.startDate,
            endDate: assignment.event.endDate,
          }));

        return {
          ...item,
          conflictingEvents,
        };
      });

      // Separate available and unavailable
      const available = itemsWithConflicts.filter((item) => item.conflictingEvents.length === 0);
      const unavailable = itemsWithConflicts.filter((item) => item.conflictingEvents.length > 0);

      const total = available.length;
      const paginated = available.slice(offset, offset + input.limit);

      return {
        items: paginated,
        total,
        unavailableCount: unavailable.length,
      };
    }),
};
