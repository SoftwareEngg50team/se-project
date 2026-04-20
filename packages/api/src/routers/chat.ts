import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { auth } from "@se-project/auth";
import { db, and, desc, eq, ilike, inArray, sql } from "@se-project/db";
import { event } from "@se-project/db/schema/events";
import { equipmentCategory, equipmentItem } from "@se-project/db/schema/equipment";
import { invoice, payment, vendor } from "@se-project/db/schema/finance";
import { member, user } from "@se-project/db/schema/auth";
import { staffAssignment } from "@se-project/db/schema/staff";
import { protectedProcedure } from "../index";
import { ensureScopedIds, resolveOrganizationId, resolveOrganizationUserIds } from "../tenant";

const inputSchema = z.object({
  message: z.string().trim().min(1),
});

const outputSchema = z.object({
  reply: z.string(),
  intent: z.enum([
    "help",
    "summary",
    "create_event",
    "add_equipment",
    "add_vendor",
    "record_payment",
    "add_staff",
    "staff_workload",
    "unknown",
  ]),
  success: z.boolean(),
  navigationPath: z.string().optional(),
});

type ContextLike = any;

const defaultEquipmentCategories: Array<{ name: string; description: string }> = [
  { name: "Speakers", description: "Passive and active PA speakers for events" },
  { name: "Subwoofers", description: "Low-frequency subwoofer systems" },
  { name: "Amplifiers", description: "Power amplifiers and rack amps" },
  { name: "Mixers", description: "Analog and digital audio mixing consoles" },
  { name: "Microphones", description: "Wired and wireless microphones" },
  { name: "DI Boxes", description: "Direct input boxes and signal interfaces" },
  { name: "Stage Lights", description: "LED par cans, spotlights, and wash lights" },
  { name: "Moving Heads", description: "Intelligent moving head fixtures" },
  { name: "Lighting Controllers", description: "DMX controllers and lighting desks" },
  { name: "DMX Accessories", description: "DMX splitters, cables, and terminators" },
  { name: "Trusses", description: "Aluminum truss sections and rigging hardware" },
  { name: "Generators", description: "Portable power generators and backup units" },
  { name: "Power Distribution", description: "Distribution boxes, extension reels, and connectors" },
  { name: "LED Walls", description: "LED panel modules and processors" },
  { name: "Projectors", description: "Projectors, lenses, and projection accessories" },
];

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function ensureOrganizationForUser(headers: Headers, user: { id: string; name?: string | null }) {
  const organizations = await auth.api.listOrganizations({ headers });
  if (organizations.length > 0) {
    return organizations[0]!;
  }

  const organizationName = user.name?.trim()
    ? `${user.name.trim()}'s Organization`
    : "My Organization";
  const baseSlug = toSlug(organizationName) || "organization";
  const suffix = user.id.slice(0, 8).toLowerCase();

  return auth.api.createOrganization({
    headers,
    body: {
      name: organizationName,
      slug: `${baseSlug}-${suffix}`,
    },
  });
}

async function hasPermission(context: ContextLike, permissions: Record<string, string[]>) {
  const organization = await ensureOrganizationForUser(context.headers, context.session.user);
  const result = await auth.api.hasPermission({
    headers: context.headers,
    body: {
      permissions,
      organizationId: organization.id,
    },
  });

  return result.success;
}

function parseArgs(message: string) {
  const map = new Map<string, string>();
  const matcher = /([a-zA-Z_][a-zA-Z0-9_\-]*)\s*=\s*("[^"]*"|'[^']*'|[^,;\n]+)/g;

  for (const match of message.matchAll(matcher)) {
    const key = match[1]?.trim().toLowerCase();
    const raw = match[2]?.trim() ?? "";
    if (!key) continue;
    const value = raw.replace(/^['"]|['"]$/g, "").trim();
    map.set(key, value);
  }

  return map;
}

function getArg(args: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = args.get(key.toLowerCase());
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
}

function parseMoneyToPaise(value: string | undefined) {
  if (!value) return undefined;
  const clean = value.replace(/[^\d.]/g, "").trim();
  if (!clean) return undefined;
  if (!clean.includes(".")) {
    return Number.parseInt(clean, 10);
  }
  const numeric = Number.parseFloat(clean);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(numeric * 100);
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildHelpReply() {
  return [
    "I can answer business questions and run manual operations from chat.",
    "",
    "Use commands with key=value pairs:",
    "1) create event name=Corporate Meetup, start=2026-05-10T10:00, end=2026-05-10T18:00, location=Expo Hall, client=Acme, revenue=500000",
    "2) add equipment name=JBL Speaker, category=Speakers, status=available, purchaseCost=250000",
    "3) add vendor name=Star Catering, type=food, phone=9876543210, email=team@star.com",
    "4) record payment invoice=INV-12345, amount=150000, type=customer_payment, method=upi",
    "5) add staff email=teammate@example.com, role=staff",
    "6) staff workload",
    "",
    "General queries also work: 'show dashboard summary', 'how many unpaid invoices', 'what should I do next'.",
  ].join("\n");
}

async function summaryReply(context: ContextLike) {
  const { userIds } = await resolveOrganizationUserIds(context);
  const scopedUserIds = ensureScopedIds(userIds);
  const scopedEvents = await db
    .select({ id: event.id })
    .from(event)
    .where(inArray(event.createdBy, scopedUserIds));
  const scopedEventIds = scopedEvents.map((row) => row.id);

  if (scopedEventIds.length === 0) {
    return [
      "Here is your current business snapshot:",
      "- No events found in your organization yet.",
      "- Tip: create your first event to start tracking invoices, vendors, and payments.",
    ].join("\n");
  }

  const [eventCount] = await db
    .select({ total: sql<number>`count(*)` })
    .from(event)
    .where(inArray(event.id, scopedEventIds));

  const [invoiceCount] = await db
    .select({ total: sql<number>`count(*)` })
    .from(invoice)
    .where(inArray(invoice.eventId, scopedEventIds));

  const [unpaidCount] = await db
    .select({ total: sql<number>`count(*)` })
    .from(invoice)
    .where(and(inArray(invoice.eventId, scopedEventIds), sql`${invoice.status} != 'paid'`));

  const [revenueResult] = await db
    .select({ total: sql<number>`coalesce(sum(${event.totalRevenue}), 0)` })
    .from(event)
    .where(inArray(event.id, scopedEventIds));

  const [paymentResult] = await db
    .select({ total: sql<number>`coalesce(sum(${payment.amount}), 0)` })
    .from(payment)
    .where(inArray(payment.eventId, scopedEventIds));

  return [
    "Here is your current business snapshot:",
    `- Total events: ${Number(eventCount?.total ?? 0)}`,
    `- Total invoices: ${Number(invoiceCount?.total ?? 0)}`,
    `- Unpaid/partial invoices: ${Number(unpaidCount?.total ?? 0)}`,
    `- Event revenue tracked: ${formatInr(Number(revenueResult?.total ?? 0))}`,
    `- Total payments recorded: ${formatInr(Number(paymentResult?.total ?? 0))}`,
  ].join("\n");
}

async function handleAddStaff(message: string, context: ContextLike) {
  const allowed = await hasPermission(context, { member: ["create"] });
  if (!allowed) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have permission to add staff" });
  }

  const args = parseArgs(message);
  const email = getArg(args, ["email"]);
  const roleInput = getArg(args, ["role"]);
  const role = roleInput === "event_head" ? "event_head" : "staff";

  if (!email) {
    return {
      reply: "Missing email. Use: add staff email=teammate@example.com, role=staff",
      intent: "add_staff" as const,
      success: false,
    };
  }

  const organizationId = await resolveOrganizationId(context);
  const existingUser = await db.query.user.findFirst({ where: eq(user.email, email.trim().toLowerCase()) });

  if (!existingUser) {
    return {
      reply: "No user account found with that email. Ask them to sign up first, then run this command again.",
      intent: "add_staff" as const,
      success: false,
      navigationPath: "/staff",
    };
  }

  const existingMembership = await db.query.member.findFirst({
    where: and(eq(member.userId, existingUser.id), eq(member.organizationId, organizationId)),
  });

  if (existingMembership) {
    return {
      reply: `${existingUser.name || existingUser.email} is already in your team.`,
      intent: "add_staff" as const,
      success: true,
      navigationPath: "/staff",
    };
  }

  await db.insert(member).values({
    id: crypto.randomUUID(),
    userId: existingUser.id,
    organizationId,
    role,
  });

  return {
    reply: `${existingUser.name || existingUser.email} added as ${role.replace("_", " ")}.`,
    intent: "add_staff" as const,
    success: true,
    navigationPath: "/staff",
  };
}

async function handleStaffWorkload(context: ContextLike) {
  const { organizationId, userIds } = await resolveOrganizationUserIds(context);
  const scopedUserIds = ensureScopedIds(userIds);
  const now = new Date();

  const teamMembers = await db
    .select({
      userId: user.id,
      name: user.name,
      role: member.role,
    })
    .from(user)
    .innerJoin(member, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.userId, scopedUserIds),
        inArray(member.role, ["staff", "event_head"]),
      ),
    );

  if (teamMembers.length === 0) {
    return {
      reply: "No staff members found yet. Add staff from the Staff page or by command: add staff email=...",
      intent: "staff_workload" as const,
      success: true,
      navigationPath: "/staff",
    };
  }

  const assignments = await db
    .select({
      userId: staffAssignment.userId,
      startDate: event.startDate,
      createdBy: event.createdBy,
    })
    .from(staffAssignment)
    .innerJoin(event, eq(staffAssignment.eventId, event.id))
    .where(inArray(staffAssignment.userId, teamMembers.map((memberRow) => memberRow.userId)));

  const lines = teamMembers.map((memberRow) => {
    const memberAssignments = assignments.filter(
      (assignment) =>
        assignment.userId === memberRow.userId &&
        scopedUserIds.includes(assignment.createdBy),
    );
    const upcoming = memberAssignments.filter((assignment) => assignment.startDate >= now).length;
    return `- ${memberRow.name || "Unnamed user"}: ${upcoming} upcoming (${memberAssignments.length} total)`;
  });

  return {
    reply: ["Staff workload summary:", ...lines].join("\n"),
    intent: "staff_workload" as const,
    success: true,
    navigationPath: "/staff",
  };
}

async function handleCreateEvent(message: string, context: ContextLike) {
  const allowed = await hasPermission(context, { event: ["create"] });
  if (!allowed) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have permission to create events" });
  }

  const args = parseArgs(message);
  const name = getArg(args, ["name", "event", "title"]);
  const location = getArg(args, ["location", "venue"]);
  const clientName = getArg(args, ["client", "clientname"]);
  const startDate = parseDate(getArg(args, ["start", "startdate"]));
  const endDate = parseDate(getArg(args, ["end", "enddate"]));

  if (!name || !location || !clientName || !startDate || !endDate) {
    return {
      reply:
        "Missing required event fields. Use: create event name=..., start=..., end=..., location=..., client=...",
      intent: "create_event" as const,
      success: false,
    };
  }

  const totalRevenue = parseMoneyToPaise(getArg(args, ["revenue", "totalrevenue"]));

  const [created] = await db
    .insert(event)
    .values({
      name,
      startDate,
      endDate,
      location,
      clientName,
      clientPhone: getArg(args, ["phone", "clientphone"]),
      clientEmail: getArg(args, ["email", "clientemail"]),
      notes: getArg(args, ["notes"]),
      totalRevenue,
      createdBy: context.session.user.id,
    })
    .returning();

  return {
    reply: `Event '${created!.name}' created successfully.`,
    intent: "create_event" as const,
    success: true,
    navigationPath: `/events/${created!.id}`,
  };
}

async function ensureEquipmentCategories() {
  await db
    .insert(equipmentCategory)
    .values(defaultEquipmentCategories)
    .onConflictDoNothing();
}

async function handleAddEquipment(message: string, context: ContextLike) {
  const allowed = await hasPermission(context, { event: ["create"] });
  if (!allowed) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have permission to add equipment" });
  }

  await ensureEquipmentCategories();

  const args = parseArgs(message);
  const name = getArg(args, ["name", "equipment", "item"]);
  const categoryInput = getArg(args, ["category", "categoryname"]);

  if (!name) {
    return {
      reply: "Missing equipment name. Use: add equipment name=..., category=Speakers",
      intent: "add_equipment" as const,
      success: false,
    };
  }

  let selectedCategory = categoryInput
    ? await db.query.equipmentCategory.findFirst({ where: ilike(equipmentCategory.name, categoryInput) })
    : undefined;

  if (!selectedCategory) {
    selectedCategory = await db.query.equipmentCategory.findFirst({ orderBy: desc(equipmentCategory.name) });
  }

  if (!selectedCategory) {
    throw new ORPCError("BAD_REQUEST", { message: "No equipment categories available" });
  }

  const status = getArg(args, ["status"]);
  const normalizedStatus =
    status && ["available", "assigned", "in_transit", "at_event", "under_repair"].includes(status)
      ? (status as "available" | "assigned" | "in_transit" | "at_event" | "under_repair")
      : "available";

  const [created] = await db
    .insert(equipmentItem)
    .values({
      name,
      categoryId: selectedCategory.id,
      status: normalizedStatus,
      purchaseDate: parseDate(getArg(args, ["purchasedate", "date"])),
      purchaseCost: parseMoneyToPaise(getArg(args, ["purchasecost", "cost"])),
      notes: getArg(args, ["notes"]),
      createdBy: context.session.user.id,
    })
    .returning();

  return {
    reply: `Equipment '${created!.name}' added in '${selectedCategory.name}'.`,
    intent: "add_equipment" as const,
    success: true,
    navigationPath: `/equipment/${created!.id}`,
  };
}

async function handleAddVendor(message: string, context: ContextLike) {
  const allowed = await hasPermission(context, { event: ["create"] });
  if (!allowed) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have permission to add vendors" });
  }

  const args = parseArgs(message);
  const name = getArg(args, ["name", "vendor"]);
  const type = getArg(args, ["type"]);
  const normalizedType = ["food", "transportation", "repair", "other"].includes(type ?? "")
    ? (type as "food" | "transportation" | "repair" | "other")
    : "other";

  if (!name) {
    return {
      reply: "Missing vendor name. Use: add vendor name=..., type=food|transportation|repair|other",
      intent: "add_vendor" as const,
      success: false,
    };
  }

  const [created] = await db
    .insert(vendor)
    .values({
      name,
      type: normalizedType,
      phone: getArg(args, ["phone"]),
      email: getArg(args, ["email"]),
      createdBy: context.session.user.id,
    })
    .returning();

  return {
    reply: `Vendor '${created!.name}' added successfully.`,
    intent: "add_vendor" as const,
    success: true,
    navigationPath: `/vendors/${created!.id}`,
  };
}

async function resolveInvoiceOrEvent(args: Map<string, string>) {
  const invoiceNumber = getArg(args, ["invoice", "invoicenumber"]);
  const invoiceId = getArg(args, ["invoiceid"]);
  const eventId = getArg(args, ["eventid"]);

  if (invoiceId) {
    const invoiceRecord = await db.query.invoice.findFirst({ where: eq(invoice.id, invoiceId) });
    return { invoiceRecord, resolvedEventId: invoiceRecord?.eventId ?? eventId };
  }

  if (invoiceNumber) {
    const invoiceRecord = await db.query.invoice.findFirst({ where: eq(invoice.invoiceNumber, invoiceNumber) });
    return { invoiceRecord, resolvedEventId: invoiceRecord?.eventId ?? eventId };
  }

  return { invoiceRecord: undefined, resolvedEventId: eventId };
}

async function handleRecordPayment(message: string, context: ContextLike) {
  const allowed = await hasPermission(context, { finance: ["create"] });
  if (!allowed) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have permission to record payments" });
  }

  const args = parseArgs(message);
  const amount = parseMoneyToPaise(getArg(args, ["amount"]));
  if (!amount || amount < 1) {
    return {
      reply: "Missing or invalid amount. Use: record payment invoice=INV-123, amount=150000",
      intent: "record_payment" as const,
      success: false,
    };
  }

  const typeInput = getArg(args, ["type"]);
  const paymentType = ["customer_advance", "customer_payment", "vendor_payment"].includes(typeInput ?? "")
    ? (typeInput as "customer_advance" | "customer_payment" | "vendor_payment")
    : "customer_payment";

  const { invoiceRecord, resolvedEventId } = await resolveInvoiceOrEvent(args);
  if (!resolvedEventId) {
    return {
      reply: "Missing event context. Provide eventId=... or invoice=INV-...",
      intent: "record_payment" as const,
      success: false,
    };
  }

  let resolvedVendorId = getArg(args, ["vendorid"]);
  const vendorName = getArg(args, ["vendor"]);
  if (!resolvedVendorId && vendorName) {
    const vendorRecord = await db.query.vendor.findFirst({ where: ilike(vendor.name, vendorName) });
    resolvedVendorId = vendorRecord?.id;
  }

  const [created] = await db
    .insert(payment)
    .values({
      eventId: resolvedEventId,
      invoiceId: invoiceRecord?.id,
      vendorId: resolvedVendorId,
      amount,
      paymentDate: parseDate(getArg(args, ["date", "paymentdate"])) ?? new Date(),
      paymentMethod: getArg(args, ["method", "paymentmethod"]),
      type: paymentType,
      notes: getArg(args, ["notes"]),
      recordedBy: context.session.user.id,
    })
    .returning();

  if (invoiceRecord?.id) {
    const [totalPaidResult] = await db
      .select({ totalPaid: sql<number>`coalesce(sum(${payment.amount}), 0)` })
      .from(payment)
      .where(eq(payment.invoiceId, invoiceRecord.id));

    const totalPaid = Number(totalPaidResult?.totalPaid ?? 0);
    const newStatus = totalPaid >= invoiceRecord.amount ? "paid" : "partial";
    await db.update(invoice).set({ status: newStatus }).where(eq(invoice.id, invoiceRecord.id));
  }

  return {
    reply: `Payment of ${formatInr(created!.amount)} recorded successfully.`,
    intent: "record_payment" as const,
    success: true,
    navigationPath: invoiceRecord?.id ? `/invoices/${invoiceRecord.id}` : "/payments",
  };
}

export const chatRouter = {
  respond: protectedProcedure
    .route({
      tags: ["Chat"],
      summary: "Chat assistant",
      description:
        "Answers general queries and executes operational commands like creating events, adding equipment/vendors, and recording payments.",
    })
    .input(inputSchema)
    .output(outputSchema)
    .handler(async ({ input, context }) => {
      const message = input.message.trim();
      const normalized = message.toLowerCase();

      if (
        normalized === "help" ||
        normalized === "/help" ||
        normalized.includes("what can you do") ||
        normalized.includes("commands")
      ) {
        return {
          reply: buildHelpReply(),
          intent: "help" as const,
          success: true,
        };
      }

      if (
        normalized.includes("summary") ||
        normalized.includes("dashboard") ||
        normalized.includes("snapshot") ||
        normalized.includes("unpaid invoice")
      ) {
        return {
          reply: await summaryReply(context as ContextLike),
          intent: "summary" as const,
          success: true,
          navigationPath: "/dashboard",
        };
      }

      if (normalized.includes("staff workload") || normalized.includes("team workload")) {
        return handleStaffWorkload(context as ContextLike);
      }

      if (normalized.startsWith("create event") || normalized.includes(" create event ")) {
        return handleCreateEvent(message, context as ContextLike);
      }

      if (normalized.startsWith("add equipment") || normalized.includes(" add equipment ")) {
        return handleAddEquipment(message, context as ContextLike);
      }

      if (normalized.startsWith("add vendor") || normalized.includes(" add vendor ")) {
        return handleAddVendor(message, context as ContextLike);
      }

      if (normalized.startsWith("record payment") || normalized.includes(" record payment ")) {
        return handleRecordPayment(message, context as ContextLike);
      }

      if (normalized.startsWith("add staff") || normalized.includes(" add staff ")) {
        return handleAddStaff(message, context as ContextLike);
      }

      return {
        reply:
          "I understood a general question but no direct command was detected. Type 'help' to see supported commands, or ask for 'dashboard summary'.",
        intent: "unknown" as const,
        success: true,
      };
    }),
};
