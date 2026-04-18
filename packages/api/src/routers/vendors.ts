import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, desc, count, or } from "@se-project/db";
import { vendor } from "@se-project/db/schema/finance";
import { protectedProcedure, eventHeadProcedure } from "../index";
import {
  vendorSchema,
  vendorDetailSchema,
} from "../schemas";

export const vendorsRouter = {
  list: protectedProcedure
    .route({
      tags: ["Vendors"],
      summary: "List vendors",
      description:
        "Returns a paginated list of vendors. Filter by type or search by name and email.",
    })
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(["food", "transportation", "repair", "other"]).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        vendors: z.array(vendorSchema),
        total: z.number().int(),
      }),
    )
    .handler(async ({ input }) => {
      const { search, type, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (type) {
        conditions.push(eq(vendor.type, type));
      }

      if (search) {
        conditions.push(
          or(
            ilike(vendor.name, `%${search}%`),
            ilike(vendor.email, `%${search}%`),
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [vendors, totalResult] = await Promise.all([
        db.query.vendor.findMany({
          where,
          orderBy: desc(vendor.createdAt),
          limit,
          offset,
        }),
        db
          .select({ total: count() })
          .from(vendor)
          .where(where ?? undefined),
      ]);

      return {
        vendors,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  create: eventHeadProcedure
    .route({
      tags: ["Vendors"],
      summary: "Create vendor",
      description: "Add a new vendor. Requires event head role.",
    })
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.email().optional(),
        type: z.enum(["food", "transportation", "repair", "other"]),
      }),
    )
    .output(vendorSchema)
    .handler(async ({ input }) => {
      const [created] = await db
        .insert(vendor)
        .values(input)
        .returning();

      return created!;
    }),

  update: eventHeadProcedure
    .route({
      tags: ["Vendors"],
      summary: "Update vendor",
      description: "Update vendor details. Requires event head role.",
    })
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.email().optional(),
        type: z.enum(["food", "transportation", "repair", "other"]).optional(),
      }),
    )
    .output(vendorSchema)
    .handler(async ({ input }) => {
      const { id, ...data } = input;

      const existing = await db.query.vendor.findFirst({
        where: eq(vendor.id, id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
      }

      const [updated] = await db
        .update(vendor)
        .set(data)
        .where(eq(vendor.id, id))
        .returning();

      return updated!;
    }),

  getById: protectedProcedure
    .route({
      tags: ["Vendors"],
      summary: "Get vendor by ID",
      description:
        "Fetch a vendor with their associated expenses and payment history.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(vendorDetailSchema)
    .handler(async ({ input }) => {
      const result = await db.query.vendor.findFirst({
        where: eq(vendor.id, input.id),
        with: {
          expenses: {
            with: {
              event: true,
            },
          },
          payments: {
            with: {
              event: true,
              invoice: true,
            },
          },
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
      }

      return result;
    }),
};
