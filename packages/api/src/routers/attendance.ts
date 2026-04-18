import { z } from "zod";
import { db, eq, and, sql } from "@se-project/db";
import { attendance } from "@se-project/db/schema/staff";
import {
  protectedProcedure,
  eventHeadProcedure,
  staffProcedure,
} from "../index";
import {
  attendanceSchema,
  attendanceWithUserSchema,
  attendanceWithEventSchema,
} from "../schemas";

export const attendanceRouter = {
  record: eventHeadProcedure
    .route({
      tags: ["Attendance"],
      summary: "Record attendance",
      description:
        "Mark attendance for a staff member on a specific event date. Creates or updates the record for that event + user + date combination. Requires event head role.",
    })
    .input(
      z.object({
        eventId: z.uuid(),
        userId: z.string(),
        date: z.coerce.date(),
        present: z.boolean(),
        hoursWorked: z.number().int().min(0).optional(),
      }),
    )
    .output(attendanceSchema)
    .handler(async ({ input, context }) => {
      const markedBy = context.session.user.id;

      // Check if a record already exists for this event+user+date
      const existing = await db.query.attendance.findFirst({
        where: and(
          eq(attendance.eventId, input.eventId),
          eq(attendance.userId, input.userId),
          eq(attendance.date, input.date),
        ),
      });

      if (existing) {
        const [updated] = await db
          .update(attendance)
          .set({
            present: input.present,
            hoursWorked: input.hoursWorked ?? null,
            markedBy,
          })
          .where(eq(attendance.id, existing.id))
          .returning();

        return updated!;
      }

      const [created] = await db
        .insert(attendance)
        .values({
          eventId: input.eventId,
          userId: input.userId,
          date: input.date,
          present: input.present,
          hoursWorked: input.hoursWorked ?? null,
          markedBy,
        })
        .returning();

      return created!;
    }),

  getByEvent: protectedProcedure
    .route({
      tags: ["Attendance"],
      summary: "Get attendance for event",
      description:
        "Fetch all attendance records for a given event, including staff details.",
    })
    .input(z.object({ eventId: z.uuid() }))
    .output(z.array(attendanceWithUserSchema))
    .handler(async ({ input }) => {
      const records = await db.query.attendance.findMany({
        where: eq(attendance.eventId, input.eventId),
        with: {
          user: true,
        },
      });

      return records;
    }),

  getByStaff: staffProcedure
    .route({
      tags: ["Attendance"],
      summary: "Get attendance for staff member",
      description:
        "Fetch attendance records for a staff member, optionally filtered by date range.",
    })
    .input(
      z.object({
        userId: z.string(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }),
    )
    .output(z.array(attendanceWithEventSchema))
    .handler(async ({ input }) => {
      const conditions = [eq(attendance.userId, input.userId)];

      if (input.startDate) {
        conditions.push(
          sql`${attendance.date} >= ${input.startDate}` as ReturnType<typeof eq>,
        );
      }

      if (input.endDate) {
        conditions.push(
          sql`${attendance.date} <= ${input.endDate}` as ReturnType<typeof eq>,
        );
      }

      const records = await db.query.attendance.findMany({
        where: and(...conditions),
        with: {
          event: true,
        },
      });

      return records;
    }),
};
