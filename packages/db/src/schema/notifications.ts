import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { notificationTypeEnum } from "./enums";
import { user } from "./auth";
import { event } from "./events";

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => event.id, {
      onDelete: "set null",
    }),
    type: notificationTypeEnum("type").notNull(),
    message: text("message").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    read: boolean("read").default(false).notNull(),
  },
  (table) => [
    index("notification_user_idx").on(table.userId),
    index("notification_user_read_idx").on(table.userId, table.read),
  ],
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
  event: one(event, {
    fields: [notification.eventId],
    references: [event.id],
  }),
}));

export const insertNotificationSchema = createInsertSchema(notification);
export const selectNotificationSchema = createSelectSchema(notification);
