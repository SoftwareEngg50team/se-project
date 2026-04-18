/**
 * Shared Zod schemas for API route output types.
 *
 * Flat entity schemas are derived from drizzle-zod's createSelectSchema so
 * they stay in sync with the DB schema automatically. Nested / relational
 * schemas are composed on top of those using .extend().
 *
 * The auth tables (user, session, …) are not generated via drizzle-zod in
 * this project, so userSchema is defined manually here.
 */

import { z } from "zod";
import { selectEventSchema } from "@se-project/db/schema/events";
import {
  selectEquipmentCategorySchema,
  selectEquipmentItemSchema,
  selectEquipmentAssignmentSchema,
} from "@se-project/db/schema/equipment";
import {
  selectStaffAssignmentSchema,
  selectAttendanceSchema,
} from "@se-project/db/schema/staff";
import {
  selectVendorSchema,
  selectExpenseSchema,
  selectInvoiceSchema,
  selectInvoiceLineItemSchema,
  selectPaymentSchema,
} from "@se-project/db/schema/finance";
import { selectNotificationSchema } from "@se-project/db/schema/notifications";

// ---------------------------------------------------------------------------
// Auth — no drizzle-zod schemas in the auth package
// ---------------------------------------------------------------------------
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ---------------------------------------------------------------------------
// Flat entity schemas (derived from DB)
// ---------------------------------------------------------------------------
export { selectEventSchema as eventSchema };
export { selectEquipmentCategorySchema as equipmentCategorySchema };
export { selectEquipmentItemSchema as equipmentItemSchema };
export { selectEquipmentAssignmentSchema as equipmentAssignmentSchema };
export { selectStaffAssignmentSchema as staffAssignmentSchema };
export { selectAttendanceSchema as attendanceSchema };
export { selectVendorSchema as vendorSchema };
export { selectExpenseSchema as expenseSchema };
export { selectInvoiceSchema as invoiceSchema };
export { selectInvoiceLineItemSchema as invoiceLineItemSchema };
export { selectPaymentSchema as paymentSchema };
export { selectNotificationSchema as notificationSchema };

// ---------------------------------------------------------------------------
// Composed schemas for nested / relational query results
// ---------------------------------------------------------------------------

// Event with its creator
export const eventWithCreatorSchema = selectEventSchema.extend({
  creator: userSchema,
});

// Equipment item with its category
export const equipmentItemWithCategorySchema = selectEquipmentItemSchema.extend(
  {
    category: selectEquipmentCategorySchema,
  },
);

// Equipment category with its items
export const equipmentCategoryWithItemsSchema =
  selectEquipmentCategorySchema.extend({
    items: z.array(selectEquipmentItemSchema),
  });

// Equipment assignment with nested equipment (+ category) and assigning user
export const equipmentAssignmentDetailSchema =
  selectEquipmentAssignmentSchema.extend({
    equipment: equipmentItemWithCategorySchema,
    assignedByUser: userSchema,
  });

// Equipment item detail (full getById shape)
export const equipmentItemDetailSchema = selectEquipmentItemSchema.extend({
  category: selectEquipmentCategorySchema,
  assignments: z.array(
    selectEquipmentAssignmentSchema.extend({
      event: selectEventSchema,
      assignedByUser: userSchema,
    }),
  ),
});

// Staff assignment with its event
export const staffAssignmentWithEventSchema =
  selectStaffAssignmentSchema.extend({
    event: selectEventSchema,
  });

// Staff assignment with its user
export const staffAssignmentWithUserSchema = selectStaffAssignmentSchema.extend(
  {
    user: userSchema,
  },
);

// Attendance with user
export const attendanceWithUserSchema = selectAttendanceSchema.extend({
  user: userSchema,
});

// Attendance with event
export const attendanceWithEventSchema = selectAttendanceSchema.extend({
  event: selectEventSchema,
});

// Expense with optional vendor
export const expenseWithVendorSchema = selectExpenseSchema.extend({
  vendor: selectVendorSchema.nullable(),
});

// Vendor with all related expenses and payments
export const vendorDetailSchema = selectVendorSchema.extend({
  expenses: z.array(
    selectExpenseSchema.extend({ event: selectEventSchema }),
  ),
  payments: z.array(
    selectPaymentSchema.extend({
      event: selectEventSchema,
      invoice: selectInvoiceSchema.nullable(),
    }),
  ),
});

// Invoice with event and payments
export const invoiceWithRelationsSchema = selectInvoiceSchema.extend({
  event: selectEventSchema,
  lineItems: z.array(selectInvoiceLineItemSchema),
  payments: z.array(selectPaymentSchema),
});

// Invoice with event, payments, and creator (getById)
export const invoiceDetailSchema = selectInvoiceSchema.extend({
  event: selectEventSchema,
  lineItems: z.array(selectInvoiceLineItemSchema),
  payments: z.array(selectPaymentSchema),
  creator: userSchema,
});

// Payment with event, invoice, and vendor (list)
export const paymentWithRelationsSchema = selectPaymentSchema.extend({
  event: selectEventSchema,
  invoice: selectInvoiceSchema.nullable(),
  vendor: selectVendorSchema.nullable(),
});

// Payment with event only (dashboard recent activity)
export const paymentWithEventSchema = selectPaymentSchema.extend({
  event: selectEventSchema,
});

// Notification with optional event
export const notificationWithEventSchema = selectNotificationSchema.extend({
  event: selectEventSchema.nullable(),
});
