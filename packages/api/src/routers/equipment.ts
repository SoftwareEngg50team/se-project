import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, desc, count } from "@se-project/db";
import {
  equipmentItem,
  equipmentCategory,
} from "@se-project/db/schema/equipment";
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
    .handler(async ({ input }) => {
      const { status, categoryId, search, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (status) {
        conditions.push(eq(equipmentItem.status, status));
      }

      if (categoryId) {
        conditions.push(eq(equipmentItem.categoryId, categoryId));
      }

      if (search) {
        conditions.push(ilike(equipmentItem.name, `%${search}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

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
    .handler(async ({ input }) => {
      const result = await db.query.equipmentItem.findFirst({
        where: eq(equipmentItem.id, input.id),
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
    .handler(async ({ input }) => {
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
        .values(input)
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
    .handler(async ({ input }) => {
      const { id, ...data } = input;

      const existing = await db.query.equipmentItem.findFirst({
        where: eq(equipmentItem.id, id),
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
        .where(eq(equipmentItem.id, id))
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
    .handler(async ({ input }) => {
      const existing = await db.query.equipmentItem.findFirst({
        where: eq(equipmentItem.id, input.id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Equipment item not found",
        });
      }

      const [updated] = await db
        .update(equipmentItem)
        .set({ status: input.status })
        .where(eq(equipmentItem.id, input.id))
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
};
