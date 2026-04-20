import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, inArray } from "@se-project/db";
import { staffAssignment } from "@se-project/db/schema/staff";
import { event } from "@se-project/db/schema/events";
import { notification } from "@se-project/db/schema/notifications";
import {
  protectedProcedure,
  eventHeadProcedure,
  staffProcedure,
} from "../index";
import {
  staffAssignmentSchema,
  staffAssignmentWithEventSchema,
  staffAssignmentWithUserSchema,
} from "../schemas";
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

export const staffAssignmentsRouter = {
  assign: eventHeadProcedure
    .route({
      tags: ["Staff Assignments"],
      summary: "Assign staff to event",
      description: "Assign a staff member to an event. Requires event head role.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        userId: z.string(),
      }),
    )
    .output(staffAssignmentSchema)
    .handler(async ({ input, context }) => {
      const assignedBy = context.session.user.id;
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      if (!scopedUserIds.includes(input.userId)) {
        throw new ORPCError("FORBIDDEN", {
          message: "Cannot assign a user outside your organization",
        });
      }

      const eventRecord = await db.query.event.findFirst({
        where: and(
          eq(event.id, input.eventId),
          inArray(event.createdBy, scopedUserIds),
        ),
      });

      if (!eventRecord) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const [created] = await db
        .insert(staffAssignment)
        .values({
          eventId: input.eventId,
          userId: input.userId,
          assignedBy,
        })
        .returning();

      await db.insert(notification).values({
        userId: input.userId,
        eventId: input.eventId,
        type: "assignment",
        message: `You have been assigned to event \"${eventRecord.name}\" scheduled on ${new Date(eventRecord.startDate).toLocaleDateString("en-IN")}.`,
      });

      await db
        .update(staffAssignment)
        .set({ notificationSent: true })
        .where(eq(staffAssignment.id, created!.id));

      return created!;
    }),

  remove: eventHeadProcedure
    .route({
      tags: ["Staff Assignments"],
      summary: "Remove staff assignment",
      description:
        "Remove a staff member's assignment from an event. Requires event head role.",
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      const existing = await db.query.staffAssignment.findFirst({
        where: eq(staffAssignment.id, input.id),
        with: {
          event: true,
        },
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Staff assignment not found",
        });
      }

      if (!scopedUserIds.includes(existing.event.createdBy)) {
        throw new ORPCError("FORBIDDEN", {
          message: "You do not have access to this assignment",
        });
      }

      await db
        .delete(staffAssignment)
        .where(eq(staffAssignment.id, input.id));

      await db.insert(notification).values({
        userId: existing.userId,
        eventId: existing.eventId,
        type: "cancellation",
        message: `Your assignment for event \"${existing.event.name}\" has been cancelled.`,
      });

      return { success: true };
    }),

  getByEvent: protectedProcedure
    .route({
      tags: ["Staff Assignments"],
      summary: "Get staff assignments for event",
      description: "Fetch all staff members assigned to a given event.",
    })
    .input(z.object({ eventId: z.uuid() }))
    .output(z.array(staffAssignmentWithUserSchema))
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      const eventRecord = await db.query.event.findFirst({
        where: and(
          eq(event.id, input.eventId),
          inArray(event.createdBy, scopedUserIds),
        ),
      });

      if (!eventRecord) {
        return [];
      }

      const assignments = await db.query.staffAssignment.findMany({
        where: eq(staffAssignment.eventId, input.eventId),
        with: {
          user: true,
        },
      });

      return assignments;
    }),

  getByStaff: staffProcedure
    .route({
      tags: ["Staff Assignments"],
      summary: "Get events for staff member",
      description: "Fetch all events a staff member is assigned to.",
    })
    .input(z.object({ userId: z.string() }))
    .output(z.array(staffAssignmentWithEventSchema))
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      if (!scopedUserIds.includes(input.userId)) {
        return [];
      }

      const assignments = await db.query.staffAssignment.findMany({
        where: eq(staffAssignment.userId, input.userId),
        with: {
          event: true,
        },
      });

      return assignments.filter((assignment) =>
        scopedUserIds.includes(assignment.event.createdBy),
      );
    }),
};
