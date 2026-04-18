import QRCode from "qrcode";
import { db } from "@se-project/db";
import { env } from "@se-project/env/server";

const DEFAULT_ACCENT_COLOR = "#1A3C8F";

export const paymentTypeLabel: Record<string, string> = {
  customer_advance: "Advance",
  customer_payment: "Customer Payment",
  vendor_payment: "Vendor Payment",
};

type OrganizationMetadata = Record<string, unknown>;

export interface InvoiceExportData {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedAt: Date;
  dueDate: Date;
  subtotal: number;
  totalPaid: number;
  balanceDue: number;
  creator: {
    name: string;
    email: string;
  };
  event: {
    id: string;
    name: string;
    location: string;
    startDate: Date;
    endDate: Date;
    clientName: string;
    clientPhone: string | null;
    clientEmail: string | null;
    notes: string | null;
  };
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    serviceDate: Date | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: Date;
    paymentMethod: string | null;
    type: string;
    notes: string | null;
  }>;
  branding: {
    organizationName: string;
    logoUrl: string | null;
    accentColor: string;
    address: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    taxId: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    upiId: string | null;
    upiName: string | null;
    paymentTerms: string | null;
    paymentNotes: string | null;
  };
  paymentQrValue: string | null;
  paymentQrDataUrl: string | null;
}

function pickString(source: OrganizationMetadata, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function parseOrganizationMetadata(metadata: string | null) {
  if (!metadata) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OrganizationMetadata;
    }
  } catch {
    return {};
  }

  return {};
}

function normalizeColor(value: string | undefined) {
  if (!value) {
    return DEFAULT_ACCENT_COLOR;
  }

  const normalized = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9A-Fa-f]{6}$/.test(normalized)
    ? normalized.toUpperCase()
    : DEFAULT_ACCENT_COLOR;
}

async function resolveOrganization(
  activeOrganizationId: string | null | undefined,
  fallbackUserIds: string[],
) {
  if (activeOrganizationId) {
    const activeOrganization = await db.query.organization.findFirst({
      where: (table, { eq }) => eq(table.id, activeOrganizationId),
    });

    if (activeOrganization) {
      return activeOrganization;
    }
  }

  for (const userId of [...new Set(fallbackUserIds.filter(Boolean))]) {
    const membership = await db.query.member.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
      with: {
        organization: true,
      },
    });

    if (membership?.organization) {
      return membership.organization;
    }
  }

  return null;
}

function buildBranding(
  organizationRecord: {
    name: string;
    logo: string | null;
    metadata: string | null;
  } | null,
) {
  const metadata = parseOrganizationMetadata(organizationRecord?.metadata ?? null);
  const organizationName = organizationRecord?.name?.trim() || "EventFlow";

  return {
    organizationName,
    logoUrl: organizationRecord?.logo ?? null,
    accentColor: normalizeColor(
      pickString(metadata, ["invoiceBrandColor", "brandColor", "accentColor"])
        ?? env.INVOICE_BRAND_COLOR,
    ),
    address:
      pickString(metadata, ["billingAddress", "invoiceAddress", "address"])
      ?? env.INVOICE_COMPANY_ADDRESS
      ?? null,
    email:
      pickString(metadata, ["billingEmail", "invoiceEmail", "email"])
      ?? env.INVOICE_COMPANY_EMAIL
      ?? null,
    phone:
      pickString(metadata, ["billingPhone", "invoicePhone", "phone"])
      ?? env.INVOICE_COMPANY_PHONE
      ?? null,
    website:
      pickString(metadata, ["billingWebsite", "invoiceWebsite", "website"])
      ?? env.INVOICE_COMPANY_WEBSITE
      ?? null,
    taxId:
      pickString(metadata, ["taxId", "gstin", "invoiceTaxId"])
      ?? env.INVOICE_COMPANY_TAX_ID
      ?? null,
    bankName:
      pickString(metadata, ["bankName", "invoiceBankName"])
      ?? env.INVOICE_BANK_NAME
      ?? null,
    bankAccountName:
      pickString(metadata, ["bankAccountName", "invoiceBankAccountName"])
      ?? env.INVOICE_BANK_ACCOUNT_NAME
      ?? null,
    bankAccountNumber:
      pickString(metadata, ["bankAccountNumber", "invoiceBankAccountNumber"])
      ?? env.INVOICE_BANK_ACCOUNT_NUMBER
      ?? null,
    bankIfsc:
      pickString(metadata, ["bankIfsc", "ifsc", "invoiceBankIfsc"])
      ?? env.INVOICE_BANK_IFSC
      ?? null,
    upiId:
      pickString(metadata, ["upiId", "invoiceUpiId"])
      ?? env.INVOICE_UPI_ID
      ?? null,
    upiName:
      pickString(metadata, ["upiName", "invoiceUpiName"])
      ?? env.INVOICE_UPI_NAME
      ?? organizationName,
    paymentTerms:
      pickString(metadata, ["paymentTerms", "invoicePaymentTerms"])
      ?? env.INVOICE_PAYMENT_TERMS
      ?? "Payment is due on or before the due date shown on this invoice.",
    paymentNotes:
      pickString(metadata, ["paymentNotes", "invoicePaymentNotes"])
      ?? env.INVOICE_PAYMENT_NOTES
      ?? null,
  };
}

function buildPaymentQrValue(input: {
  upiId: string | null;
  upiName: string | null;
  amount: number;
  invoiceNumber: string;
}) {
  if (!input.upiId || input.amount <= 0) {
    return null;
  }

  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.upiName ?? "EventFlow",
    am: (input.amount / 100).toFixed(2),
    cu: "INR",
    tn: `Invoice ${input.invoiceNumber}`,
  });

  return `upi://pay?${params.toString()}`;
}

async function buildPaymentQrDataUrl(value: string | null) {
  if (!value) {
    return null;
  }

  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

export function formatInvoiceCurrency(amount: number) {
  return `\u20B9${(amount / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatInvoiceDate(date: Date | string | null | undefined) {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function getInvoiceExportData(input: {
  invoiceId: string;
  sessionUserId: string;
  activeOrganizationId?: string | null;
}) {
  const invoiceRecord = await db.query.invoice.findFirst({
    where: (table, { eq }) => eq(table.id, input.invoiceId),
    with: {
      event: true,
      creator: true,
      lineItems: true,
      payments: true,
    },
  });

  if (!invoiceRecord) {
    return null;
  }

  const organizationRecord = await resolveOrganization(
    input.activeOrganizationId,
    [input.sessionUserId, invoiceRecord.createdBy],
  );
  const branding = buildBranding(organizationRecord);

  const lineItems = (
    invoiceRecord.lineItems.length > 0
      ? invoiceRecord.lineItems
      : [
          {
            id: `legacy-${invoiceRecord.id}`,
            invoiceId: invoiceRecord.id,
            description: `Event services - ${invoiceRecord.event.name}`,
            quantity: 1,
            unitPrice: invoiceRecord.amount,
            serviceDate: invoiceRecord.event.startDate,
            sortOrder: 0,
          },
        ]
  )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
      serviceDate: item.serviceDate ?? null,
    }));

  const payments = [...invoiceRecord.payments]
    .sort(
      (a, b) =>
        new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
    )
    .map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod ?? null,
      type: payment.type,
      notes: payment.notes ?? null,
    }));

  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceDue = Math.max(0, subtotal - totalPaid);
  const paymentQrValue = buildPaymentQrValue({
    upiId: branding.upiId,
    upiName: branding.upiName,
    amount: balanceDue,
    invoiceNumber: invoiceRecord.invoiceNumber,
  });
  const paymentQrDataUrl = await buildPaymentQrDataUrl(paymentQrValue);

  return {
    id: invoiceRecord.id,
    invoiceNumber: invoiceRecord.invoiceNumber,
    status: invoiceRecord.status,
    issuedAt: invoiceRecord.issuedAt,
    dueDate: invoiceRecord.dueDate,
    subtotal,
    totalPaid,
    balanceDue,
    creator: {
      name: invoiceRecord.creator.name,
      email: invoiceRecord.creator.email,
    },
    event: {
      id: invoiceRecord.event.id,
      name: invoiceRecord.event.name,
      location: invoiceRecord.event.location,
      startDate: invoiceRecord.event.startDate,
      endDate: invoiceRecord.event.endDate,
      clientName: invoiceRecord.event.clientName,
      clientPhone: invoiceRecord.event.clientPhone ?? null,
      clientEmail: invoiceRecord.event.clientEmail ?? null,
      notes: invoiceRecord.event.notes ?? null,
    },
    lineItems,
    payments,
    branding,
    paymentQrValue,
    paymentQrDataUrl,
  } satisfies InvoiceExportData;
}
