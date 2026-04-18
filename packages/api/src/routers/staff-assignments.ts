import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq } from "@se-project/db";
import { staffAssignment } from "@se-project/db/schema/staff";
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

      const [created] = await db
        .insert(staffAssignment)
        .values({
          eventId: input.eventId,
          userId: input.userId,
          assignedBy,
        })
        .returning();

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
    .handler(async ({ input }) => {
      const existing = await db.query.staffAssignment.findFirst({
        where: eq(staffAssignment.id, input.id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Staff assignment not found",
        });
      }

      await db
        .delete(staffAssignment)
        .where(eq(staffAssignment.id, input.id));

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
    .handler(async ({ input }) => {
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
    .handler(async ({ input }) => {
      const assignments = await db.query.staffAssignment.findMany({
        where: eq(staffAssignment.userId, input.userId),
        with: {
          event: true,
        },
      });

      return assignments;
    }),
};
