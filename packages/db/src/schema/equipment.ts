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
import { equipmentStatusEnum, returnStatusEnum } from "./enums";
import { user } from "./auth";
import { event } from "./events";

export const equipmentCategory = pgTable("equipment_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const equipmentItem = pgTable(
  "equipment_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => equipmentCategory.id, { onDelete: "restrict" }),
    status: equipmentStatusEnum("status").default("available").notNull(),
    purchaseDate: timestamp("purchase_date"),
    purchaseCost: integer("purchase_cost"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("equipment_item_category_idx").on(table.categoryId),
    index("equipment_item_status_idx").on(table.status),
  ],
);

export const equipmentAssignment = pgTable(
  "equipment_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipmentItem.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    returnedAt: timestamp("returned_at"),
    returnStatus: returnStatusEnum("return_status").default("pending"),
    damageNotes: text("damage_notes"),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("equip_assign_event_idx").on(table.eventId),
    index("equip_assign_equipment_idx").on(table.equipmentId),
  ],
);

export const equipmentCategoryRelations = relations(
  equipmentCategory,
  ({ many }) => ({
    items: many(equipmentItem),
  }),
);

export const equipmentItemRelations = relations(
  equipmentItem,
  ({ one, many }) => ({
    category: one(equipmentCategory, {
      fields: [equipmentItem.categoryId],
      references: [equipmentCategory.id],
    }),
    assignments: many(equipmentAssignment),
  }),
);

export const equipmentAssignmentRelations = relations(
  equipmentAssignment,
  ({ one }) => ({
    event: one(event, {
      fields: [equipmentAssignment.eventId],
      references: [event.id],
    }),
    equipment: one(equipmentItem, {
      fields: [equipmentAssignment.equipmentId],
      references: [equipmentItem.id],
    }),
    assignedByUser: one(user, {
      fields: [equipmentAssignment.assignedBy],
      references: [user.id],
    }),
  }),
);

export const insertEquipmentCategorySchema =
  createInsertSchema(equipmentCategory);
export const selectEquipmentCategorySchema =
  createSelectSchema(equipmentCategory);
export const insertEquipmentItemSchema = createInsertSchema(equipmentItem);
export const selectEquipmentItemSchema = createSelectSchema(equipmentItem);
export const insertEquipmentAssignmentSchema =
  createInsertSchema(equipmentAssignment);
export const selectEquipmentAssignmentSchema =
  createSelectSchema(equipmentAssignment);
