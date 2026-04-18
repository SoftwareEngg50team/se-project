import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { eventStatusEnum } from "./enums";
import { user } from "./auth";

export const event = pgTable(
  "event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    location: text("location").notNull(),
    status: eventStatusEnum("status").default("upcoming").notNull(),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    clientEmail: text("client_email"),
    notes: text("notes"),
    totalRevenue: integer("total_revenue"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("event_status_idx").on(table.status),
    index("event_start_date_idx").on(table.startDate),
    index("event_created_by_idx").on(table.createdBy),
  ],
);

export const eventRelations = relations(event, ({ one }) => ({
  creator: one(user, {
    fields: [event.createdBy],
    references: [user.id],
  }),
}));

export const insertEventSchema = createInsertSchema(event);
export const selectEventSchema = createSelectSchema(event);
