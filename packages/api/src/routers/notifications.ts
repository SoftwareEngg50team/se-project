import { z } from "zod";
import { db, eq, and, desc, count, inArray } from "@se-project/db";
import { notification } from "@se-project/db/schema/notifications";
import { user, member } from "@se-project/db/schema/auth";
import { staffAssignment } from "@se-project/db/schema/staff";
import { event } from "@se-project/db/schema/events";
import { protectedProcedure, eventHeadProcedure } from "../index";
import {
  notificationWithEventSchema,
} from "../schemas";
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

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

  sendWeeklyDigest: eventHeadProcedure
    .route({
      tags: ["Notifications"],
      summary: "Send weekly digest notifications",
      description:
        "Create in-app weekly digest notifications for all staff with upcoming assignments in the next 7 days.",
    })
    .output(
      z.object({
        success: z.literal(true),
        recipients: z.number().int(),
      }),
    )
    .handler(async ({ context }) => {
      const { organizationId, userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      const teamMembers = await db
        .select({
          userId: user.id,
          name: user.name,
        })
        .from(user)
        .innerJoin(member, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, organizationId),
            inArray(member.userId, scopedUserIds),
            inArray(member.role, ["staff", "event_head"]),
          ),
        );

      if (teamMembers.length === 0) {
        return { success: true as const, recipients: 0 };
      }

      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const assignments = await db.query.staffAssignment.findMany({
        where: inArray(staffAssignment.userId, teamMembers.map((m) => m.userId)),
        with: {
          event: true,
        },
      });

      const digestRows = assignments.filter(
        (assignment) =>
          scopedUserIds.includes(assignment.event.createdBy) &&
          assignment.event.status !== "cancelled" &&
          assignment.event.startDate >= now &&
          assignment.event.startDate <= nextWeek,
      );

      const notificationsToInsert: Array<{
        userId: string;
        eventId: string | null;
        type: "weekly_digest";
        message: string;
      }> = [];

      for (const memberRow of teamMembers) {
        const upcoming = digestRows
          .filter((assignment) => assignment.userId === memberRow.userId)
          .sort(
            (a, b) =>
              new Date(a.event.startDate).getTime() -
              new Date(b.event.startDate).getTime(),
          );

        if (upcoming.length === 0) {
          continue;
        }

        const eventNames = upcoming
          .slice(0, 3)
          .map((assignment) => assignment.event.name)
          .join(", ");

        const moreCount = Math.max(0, upcoming.length - 3);
        const suffix = moreCount > 0 ? ` and ${moreCount} more` : "";

        notificationsToInsert.push({
          userId: memberRow.userId,
          eventId: upcoming[0]?.eventId ?? null,
          type: "weekly_digest",
          message: `Weekly schedule: ${upcoming.length} upcoming assignment(s) this week, including ${eventNames}${suffix}.`,
        });
      }

      if (notificationsToInsert.length > 0) {
        await db.insert(notification).values(notificationsToInsert);
      }

      return {
        success: true as const,
        recipients: notificationsToInsert.length,
      };
    }),
};
