import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, desc, count, or, inArray, sql } from "@se-project/db";
import { vendor, expense, payment } from "@se-project/db/schema/finance";
import { event } from "@se-project/db/schema/events";
import { protectedProcedure, eventHeadProcedure } from "../index";
import {
  vendorSchema,
  vendorDetailSchema,
} from "../schemas";
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

async function resolveScopedLinkedVendorIds(scopedUserIds: string[]) {
  const scopedEvents = await db
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.createdBy, scopedUserIds));
  const scopedEventIds = scopedEvents.map((row) => row.id);

  if (scopedEventIds.length === 0) {
    return [] as string[];
  }

  const [expenseVendorRows, paymentVendorRows] = await Promise.all([
    db
      .select({ id: expense.vendorId })
      .from(expense)
      .where(and(inArray(expense.eventId, scopedEventIds), sql`${expense.vendorId} is not null`)),
    db
      .select({ id: payment.vendorId })
      .from(payment)
      .where(and(inArray(payment.eventId, scopedEventIds), sql`${payment.vendorId} is not null`)),
  ]);

  return Array.from(
    new Set(
      [
        ...expenseVendorRows.map((row) => row.id),
        ...paymentVendorRows.map((row) => row.id),
      ].filter((id): id is string => typeof id === "string"),
    ),
  );
}

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
    .handler(async ({ input, context }) => {
      const { search, type, page, limit } = input;
      const offset = (page - 1) * limit;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedVendorIds = await resolveScopedLinkedVendorIds(scopedUserIds);

      const where = and(
        or(
          inArray(vendor.createdBy, scopedUserIds),
          linkedVendorIds.length > 0
            ? inArray(vendor.id, linkedVendorIds)
            : undefined,
        ),
        type ? eq(vendor.type, type) : undefined,
        search
          ? or(
              ilike(vendor.name, `%${search}%`),
              ilike(vendor.email, `%${search}%`),
            )
          : undefined,
      );

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
    .handler(async ({ input, context }) => {
      const [created] = await db
        .insert(vendor)
        .values({
          ...input,
          createdBy: context.session.user.id,
        })
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
    .handler(async ({ input, context }) => {
      const { id, ...data } = input;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedVendorIds = await resolveScopedLinkedVendorIds(scopedUserIds);

      const existing = await db.query.vendor.findFirst({
        where: and(
          eq(vendor.id, id),
          or(
            inArray(vendor.createdBy, scopedUserIds),
            linkedVendorIds.length > 0
              ? inArray(vendor.id, linkedVendorIds)
              : undefined,
          ),
        ),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Vendor not found" });
      }

      const [updated] = await db
        .update(vendor)
        .set(data)
        .where(
          and(
            eq(vendor.id, id),
            or(
              inArray(vendor.createdBy, scopedUserIds),
              linkedVendorIds.length > 0
                ? inArray(vendor.id, linkedVendorIds)
                : undefined,
            ),
          ),
        )
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
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const linkedVendorIds = await resolveScopedLinkedVendorIds(scopedUserIds);

      const result = await db.query.vendor.findFirst({
        where: and(
          eq(vendor.id, input.id),
          or(
            inArray(vendor.createdBy, scopedUserIds),
            linkedVendorIds.length > 0
              ? inArray(vendor.id, linkedVendorIds)
              : undefined,
          ),
        ),
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
