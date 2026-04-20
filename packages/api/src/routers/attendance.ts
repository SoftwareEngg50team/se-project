import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, sql, inArray } from "@se-project/db";
import { attendance } from "@se-project/db/schema/staff";
import { event } from "@se-project/db/schema/events";
import { member, user } from "@se-project/db/schema/auth";
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
import { ensureScopedIds, resolveOrganizationUserIds } from "../tenant";

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
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      if (!scopedUserIds.includes(input.userId)) {
        throw new ORPCError("FORBIDDEN", {
          message: "Cannot record attendance for user outside your organization",
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

      const records = await db.query.attendance.findMany({
        where: eq(attendance.eventId, input.eventId),
        with: {
          user: true,
        },
      });

      return records;
    }),

  getEventPayout: protectedProcedure
    .route({
      tags: ["Attendance"],
      summary: "Get event salary payout summary",
      description:
        "Calculates salary payout for an event using attendance hours and each staff member's configured hourly rate.",
    })
    .input(z.object({ eventId: z.uuid() }))
    .output(
      z.object({
        rows: z.array(
          z.object({
            userId: z.string(),
            name: z.string(),
            hourlyRate: z.number().int(),
            totalHours: z.number(),
            payout: z.number().int(),
          }),
        ),
        totalHours: z.number(),
        totalPayout: z.number().int(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { organizationId, userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      const eventRecord = await db.query.event.findFirst({
        where: and(
          eq(event.id, input.eventId),
          inArray(event.createdBy, scopedUserIds),
        ),
      });

      if (!eventRecord) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      const records = await db.query.attendance.findMany({
        where: eq(attendance.eventId, input.eventId),
      });

      const rates = await db
        .select({
          userId: member.userId,
          name: user.name,
          hourlyRate: member.hourlyRate,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, organizationId),
            inArray(member.userId, scopedUserIds),
          ),
        );

      const groupedHours = new Map<string, number>();

      for (const record of records) {
        if (!record.present) {
          continue;
        }

        const current = groupedHours.get(record.userId) ?? 0;
        groupedHours.set(record.userId, current + (record.hoursWorked ?? 0));
      }

      const rows = rates
        .filter((rate) => groupedHours.has(rate.userId))
        .map((rate) => {
          const totalHours = groupedHours.get(rate.userId) ?? 0;
          const payout = totalHours * (rate.hourlyRate ?? 0);

          return {
            userId: rate.userId,
            name: rate.name,
            hourlyRate: rate.hourlyRate ?? 0,
            totalHours,
            payout,
          };
        })
        .sort((a, b) => b.payout - a.payout);

      const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
      const totalPayout = rows.reduce((sum, row) => sum + row.payout, 0);

      return {
        rows,
        totalHours,
        totalPayout,
      };
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
    .handler(async ({ input, context }) => {
      const { userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

      if (!scopedUserIds.includes(input.userId)) {
        return [];
      }

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

      return records.filter((record) => scopedUserIds.includes(record.event.createdBy));
    }),
};
