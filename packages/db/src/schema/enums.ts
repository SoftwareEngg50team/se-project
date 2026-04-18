import { pgEnum } from "drizzle-orm/pg-core";

export const eventStatusEnum = pgEnum("event_status", [
  "upcoming",
  "in_progress",
  "completed",
  "cancelled",
]);

export const equipmentStatusEnum = pgEnum("equipment_status", [
  "available",
  "assigned",
  "in_transit",
  "at_event",
  "under_repair",
]);

export const returnStatusEnum = pgEnum("return_status", [
  "pending",
  "returned",
  "missing",
  "damaged",
]);

export const expenseCategoryEnum = pgEnum("expense_category", [
  "salary",
  "food",
  "transportation",
  "equipment_repair",
  "miscellaneous",
]);

export const vendorTypeEnum = pgEnum("vendor_type", [
  "food",
  "transportation",
  "repair",
  "other",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "customer_advance",
  "customer_payment",
  "vendor_payment",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "assignment",
  "cancellation",
  "weekly_digest",
  "payment_reminder",
]);
