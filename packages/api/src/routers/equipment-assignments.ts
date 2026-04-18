import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq } from "@se-project/db";
import { equipmentItem } from "@se-project/db/schema/equipment";
import { equipmentAssignment } from "@se-project/db/schema/equipment";
import { event } from "@se-project/db/schema/events";
import {
  protectedProcedure,
  eventHeadProcedure,
} from "../index";
import {
  equipmentAssignmentSchema,
  equipmentAssignmentDetailSchema,
} from "../schemas";

export const equipmentAssignmentsRouter = {
  assign: eventHeadProcedure
    .route({
      tags: ["Equipment Assignments"],
      summary: "Assign equipment to event",
      description:
        "Assign an available equipment item to an event. Equipment status is automatically updated to 'assigned'. Requires the item to be in 'available' status.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        equipmentId: z.uuid(),
      }),
    )
    .output(equipmentAssignmentSchema)
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const eventRecord = await db.query.event.findFirst({
        where: eq(event.id, input.eventId),
      });

      if (!eventRecord) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const equipment = await db.query.equipmentItem.findFirst({
        where: eq(equipmentItem.id, input.equipmentId),
      });

      if (!equipment) {
        throw new ORPCError("NOT_FOUND", {
          message: "Equipment item not found",
        });
      }

      if (equipment.status !== "available") {
        throw new ORPCError("CONFLICT", {
          message: "Equipment is not available for assignment",
        });
      }

      const [assignment] = await db
        .insert(equipmentAssignment)
        .values({
          eventId: input.eventId,
          equipmentId: input.equipmentId,
          assignedBy: userId,
        })
        .returning();

      await db
        .update(equipmentItem)
        .set({ status: "assigned" })
        .where(eq(equipmentItem.id, input.equipmentId));

      return assignment!;
    }),

  recordReturn: eventHeadProcedure
    .route({
      tags: ["Equipment Assignments"],
      summary: "Record equipment return",
      description:
        "Record the return of an equipment item. Status is set to 'available' for returned/missing items, or 'under_repair' for damaged items.",
    })
    .input(
      z.object({
        assignmentId: z.uuid(),
        returnStatus: z.enum(["returned", "missing", "damaged"]),
        damageNotes: z.string().optional(),
      }),
    )
    .output(equipmentAssignmentSchema)
    .handler(async ({ input }) => {
      const existing = await db.query.equipmentAssignment.findFirst({
        where: eq(equipmentAssignment.id, input.assignmentId),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Assignment not found",
        });
      }

      if (existing.returnedAt) {
        throw new ORPCError("CONFLICT", {
          message: "Equipment has already been returned",
        });
      }

      const [updated] = await db
        .update(equipmentAssignment)
        .set({
          returnedAt: new Date(),
          returnStatus: input.returnStatus,
          damageNotes: input.damageNotes,
        })
        .where(eq(equipmentAssignment.id, input.assignmentId))
        .returning();

      const newEquipmentStatus =
        input.returnStatus === "damaged" ? "under_repair" : "available";

      await db
        .update(equipmentItem)
        .set({ status: newEquipmentStatus })
        .where(eq(equipmentItem.id, existing.equipmentId));

      return updated!;
    }),

  getByEvent: protectedProcedure
    .route({
      tags: ["Equipment Assignments"],
      summary: "Get equipment assignments for event",
      description:
        "Fetch all equipment assignments for a given event, including equipment details and category.",
    })
    .input(z.object({ eventId: z.uuid() }))
    .output(z.array(equipmentAssignmentDetailSchema))
    .handler(async ({ input }) => {
      const assignments = await db.query.equipmentAssignment.findMany({
        where: eq(equipmentAssignment.eventId, input.eventId),
        with: {
          equipment: {
            with: {
              category: true,
            },
          },
          assignedByUser: true,
        },
      });

      return assignments;
    }),
};
