import { z } from "zod";
import { db, eq, and, desc, count, inArray } from "@se-project/db";
import { notification } from "@se-project/db/schema/notifications";
import { protectedProcedure } from "../index";
import {
  notificationWithEventSchema,
} from "../schemas";

export const notificationsRouter = {
  list: protectedProcedure
    .route({
      tags: ["Notifications"],
      summary: "List notifications",
      description:
        "Returns a paginated list of notifications for the authenticated user, with linked event details. Optionally filter to unread only.",
    })
    .input(
      z.object({
        unreadOnly: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(
      z.object({
        notifications: z.array(notificationWithEventSchema),
        total: z.number().int(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { unreadOnly, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(notification.userId, userId)];

      if (unreadOnly) {
        conditions.push(eq(notification.read, false));
      }

      const where = and(...conditions);

      const [notifications, totalResult] = await Promise.all([
        db.query.notification.findMany({
          where,
          with: {
            event: true,
          },
          orderBy: desc(notification.sentAt),
          limit,
          offset,
        }),
        db
          .select({ total: count() })
          .from(notification)
          .where(where),
      ]);

      return {
        notifications,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  markRead: protectedProcedure
    .route({
      tags: ["Notifications"],
      summary: "Mark notifications as read",
      description:
        "Mark one or more notifications as read. Only affects notifications belonging to the authenticated user.",
    })
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1),
      }),
    )
    .output(z.object({ success: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      await db
        .update(notification)
        .set({ read: true })
        .where(
          and(
            inArray(notification.id, input.ids),
            eq(notification.userId, userId),
          ),
        );

      return { success: true as const };
    }),

  getUnreadCount: protectedProcedure
    .route({
      tags: ["Notifications"],
      summary: "Get unread notification count",
      description:
        "Returns the count of unread notifications for the authenticated user.",
    })
    .output(z.object({ count: z.number().int() }))
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      const [result] = await db
        .select({ total: count() })
        .from(notification)
        .where(
          and(eq(notification.userId, userId), eq(notification.read, false)),
        );

      return { count: result?.total ?? 0 };
    }),
};
