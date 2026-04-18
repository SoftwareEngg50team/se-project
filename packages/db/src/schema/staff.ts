import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { user } from "./auth";
import { event } from "./events";

export const staffAssignment = pgTable(
  "staff_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    notificationSent: boolean("notification_sent").default(false).notNull(),
  },
  (table) => [
    index("staff_assign_event_idx").on(table.eventId),
    index("staff_assign_user_idx").on(table.userId),
  ],
);

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    present: boolean("present").default(false).notNull(),
    hoursWorked: integer("hours_worked"),
    markedBy: text("marked_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("attendance_event_idx").on(table.eventId),
    index("attendance_user_idx").on(table.userId),
    index("attendance_date_idx").on(table.date),
  ],
);

export const staffAssignmentRelations = relations(
  staffAssignment,
  ({ one }) => ({
    event: one(event, {
      fields: [staffAssignment.eventId],
      references: [event.id],
    }),
    user: one(user, {
      fields: [staffAssignment.userId],
      references: [user.id],
      relationName: "staffUser",
    }),
    assignedByUser: one(user, {
      fields: [staffAssignment.assignedBy],
      references: [user.id],
      relationName: "staffAssigner",
    }),
  }),
);

export const attendanceRelations = relations(attendance, ({ one }) => ({
  event: one(event, {
    fields: [attendance.eventId],
    references: [event.id],
  }),
  user: one(user, {
    fields: [attendance.userId],
    references: [user.id],
    relationName: "attendanceUser",
  }),
  markedByUser: one(user, {
    fields: [attendance.markedBy],
    references: [user.id],
    relationName: "attendanceMarker",
  }),
}));

export const insertStaffAssignmentSchema =
  createInsertSchema(staffAssignment);
export const selectStaffAssignmentSchema =
  createSelectSchema(staffAssignment);
export const insertAttendanceSchema = createInsertSchema(attendance);
export const selectAttendanceSchema = createSelectSchema(attendance);
