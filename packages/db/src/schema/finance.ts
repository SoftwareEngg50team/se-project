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
import {
  vendorTypeEnum,
  expenseCategoryEnum,
  invoiceStatusEnum,
  paymentTypeEnum,
} from "./enums";
import { user } from "./auth";
import { event } from "./events";

export const vendor = pgTable("vendor", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  type: vendorTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    category: expenseCategoryEnum("category").notNull(),
    amount: integer("amount").notNull(),
    description: text("description"),
    vendorId: uuid("vendor_id").references(() => vendor.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("expense_event_idx").on(table.eventId),
    index("expense_vendor_idx").on(table.vendorId),
    index("expense_category_idx").on(table.category),
  ],
);

export const invoice = pgTable(
  "invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull().unique(),
    amount: integer("amount").notNull(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    dueDate: timestamp("due_date").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("invoice_event_idx").on(table.eventId),
    index("invoice_status_idx").on(table.status),
  ],
);

export const invoiceLineItem = pgTable(
  "invoice_line_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPrice: integer("unit_price").notNull(),
    serviceDate: timestamp("service_date"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    index("invoice_line_item_invoice_idx").on(table.invoiceId),
    index("invoice_line_item_sort_idx").on(table.invoiceId, table.sortOrder),
  ],
);

export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").references(() => invoice.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendor.id, {
      onDelete: "set null",
    }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    paymentDate: timestamp("payment_date").defaultNow().notNull(),
    paymentMethod: text("payment_method"),
    type: paymentTypeEnum("type").notNull(),
    notes: text("notes"),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("payment_event_idx").on(table.eventId),
    index("payment_invoice_idx").on(table.invoiceId),
    index("payment_vendor_idx").on(table.vendorId),
    index("payment_type_idx").on(table.type),
  ],
);

export const vendorRelations = relations(vendor, ({ many }) => ({
  expenses: many(expense),
  payments: many(payment),
}));

export const expenseRelations = relations(expense, ({ one }) => ({
  event: one(event, {
    fields: [expense.eventId],
    references: [event.id],
  }),
  vendor: one(vendor, {
    fields: [expense.vendorId],
    references: [vendor.id],
  }),
  creator: one(user, {
    fields: [expense.createdBy],
    references: [user.id],
  }),
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
  event: one(event, {
    fields: [invoice.eventId],
    references: [event.id],
  }),
  creator: one(user, {
    fields: [invoice.createdBy],
    references: [user.id],
  }),
  lineItems: many(invoiceLineItem),
  payments: many(payment),
}));

export const invoiceLineItemRelations = relations(invoiceLineItem, ({ one }) => ({
  invoice: one(invoice, {
    fields: [invoiceLineItem.invoiceId],
    references: [invoice.id],
  }),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
  invoice: one(invoice, {
    fields: [payment.invoiceId],
    references: [invoice.id],
  }),
  vendor: one(vendor, {
    fields: [payment.vendorId],
    references: [vendor.id],
  }),
  event: one(event, {
    fields: [payment.eventId],
    references: [event.id],
  }),
  recorder: one(user, {
    fields: [payment.recordedBy],
    references: [user.id],
  }),
}));

export const insertVendorSchema = createInsertSchema(vendor);
export const selectVendorSchema = createSelectSchema(vendor);
export const insertExpenseSchema = createInsertSchema(expense);
export const selectExpenseSchema = createSelectSchema(expense);
export const insertInvoiceSchema = createInsertSchema(invoice);
export const selectInvoiceSchema = createSelectSchema(invoice);
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItem);
export const selectInvoiceLineItemSchema = createSelectSchema(invoiceLineItem);
export const insertPaymentSchema = createInsertSchema(payment);
export const selectPaymentSchema = createSelectSchema(payment);
