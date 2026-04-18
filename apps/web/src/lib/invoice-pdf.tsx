import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { InvoiceExportData } from "@/lib/invoice-export";
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  paymentTypeLabel,
} from "@/lib/invoice-export";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0F172A",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
  },
  headerBand: {
    height: 8,
    borderRadius: 6,
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    width: "62%",
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
  },
  logoFallback: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    marginBottom: 4,
  },
  companyMeta: {
    color: "#475569",
    marginBottom: 2,
    lineHeight: 1.35,
  },
  invoiceMetaCard: {
    width: 190,
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  invoiceLabel: {
    fontSize: 9,
    color: "#64748B",
    marginBottom: 2,
  },
  invoiceValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 7,
  },
  invoiceTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  statusText: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  sectionRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  sectionCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  sectionCardSpacer: {
    width: 12,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 8,
  },
  sectionText: {
    color: "#334155",
    marginBottom: 3,
    lineHeight: 1.35,
  },
  table: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  tableRowAlt: {
    backgroundColor: "#F8FAFC",
  },
  tableCell: {
    color: "#0F172A",
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  summaryBlock: {
    alignSelf: "flex-end",
    width: 220,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryLabel: {
    color: "#475569",
  },
  summaryValue: {
    fontFamily: "Helvetica-Bold",
  },
  summaryDueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  summaryDueLabel: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  summaryDueValue: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  paymentRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  paymentCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    minHeight: 150,
  },
  qrImage: {
    width: 112,
    height: 112,
    marginBottom: 8,
  },
  qrCaption: {
    fontSize: 8,
    color: "#64748B",
    lineHeight: 1.35,
  },
  bankLine: {
    marginBottom: 4,
    color: "#334155",
    lineHeight: 1.35,
  },
  footerCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  footerTitle: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  footerText: {
    color: "#475569",
    lineHeight: 1.4,
    marginBottom: 3,
  },
});

function numberToWords(n: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  if (n === 0) return "Zero";

  function convert(num: number): string {
    if (num < 20) return ones[num]!;
    if (num < 100) return tens[Math.floor(num / 10)]! + (num % 10 ? ` ${ones[num % 10]!}` : "");
    if (num < 1000) return ones[Math.floor(num / 100)]! + " Hundred" + (num % 100 ? ` ${convert(num % 100)}` : "");
    if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? ` ${convert(num % 1000)}` : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? ` ${convert(num % 100000)}` : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? ` ${convert(num % 10000000)}` : "");
  }

  return `${convert(n)} Rupees`;
}

function getStatusColor(status: string) {
  switch (status) {
    case "paid":
      return "#15803D";
    case "partial":
      return "#B45309";
    case "overdue":
      return "#B91C1C";
    case "sent":
      return "#1D4ED8";
    default:
      return "#475569";
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function InvoicePDF({ data }: { data: InvoiceExportData }) {
  const statusColor = getStatusColor(data.status);
  const amountInWords = numberToWords(Math.round(data.subtotal / 100));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View
          style={[
            styles.headerBand,
            { backgroundColor: data.branding.accentColor },
          ]}
        />

        <View style={styles.header}>
          <View style={styles.brandRow}>
            {data.branding.logoUrl ? (
              <Image src={data.branding.logoUrl} style={styles.logo} />
            ) : (
              <View
                style={[
                  styles.logoFallback,
                  { backgroundColor: data.branding.accentColor },
                ]}
              >
                <Text style={styles.logoFallbackText}>
                  {getInitials(data.branding.organizationName)}
                </Text>
              </View>
            )}
            <View>
              <Text
                style={[
                  styles.companyName,
                  { color: data.branding.accentColor },
                ]}
              >
                {data.branding.organizationName}
              </Text>
              {data.branding.address && (
                <Text style={styles.companyMeta}>{data.branding.address}</Text>
              )}
              {(data.branding.phone || data.branding.email) && (
                <Text style={styles.companyMeta}>
                  {[data.branding.phone, data.branding.email].filter(Boolean).join("  |  ")}
                </Text>
              )}
              {(data.branding.website || data.branding.taxId) && (
                <Text style={styles.companyMeta}>
                  {[data.branding.website, data.branding.taxId].filter(Boolean).join("  |  ")}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.invoiceMetaCard}>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor },
              ]}
            >
              <Text style={styles.statusText}>{data.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.invoiceLabel}>Invoice number</Text>
            <Text style={styles.invoiceValue}>{data.invoiceNumber}</Text>
            <Text style={styles.invoiceLabel}>Issued on</Text>
            <Text style={styles.invoiceValue}>{formatInvoiceDate(data.issuedAt)}</Text>
            <Text style={styles.invoiceLabel}>Due date</Text>
            <Text style={styles.invoiceValue}>{formatInvoiceDate(data.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.sectionText}>{data.event.clientName}</Text>
            {data.event.clientPhone && (
              <Text style={styles.sectionText}>{data.event.clientPhone}</Text>
            )}
            {data.event.clientEmail && (
              <Text style={styles.sectionText}>{data.event.clientEmail}</Text>
            )}
          </View>
          <View style={styles.sectionCardSpacer} />
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            <Text style={styles.sectionText}>{data.event.name}</Text>
            <Text style={styles.sectionText}>{data.event.location}</Text>
            <Text style={styles.sectionText}>
              {formatInvoiceDate(data.event.startDate)} - {formatInvoiceDate(data.event.endDate)}
            </Text>
            <Text style={styles.sectionText}>Prepared by {data.creator.name}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View
            style={[
              styles.tableHeader,
              { backgroundColor: data.branding.accentColor },
            ]}
          >
            <Text style={[styles.tableHeaderCell, { flex: 1.15 }]}>Service Date</Text>
            <Text style={[styles.tableHeaderCell, { flex: 3.15 }]}>Description</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: "right" }]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Amount</Text>
          </View>
          {data.lineItems.map((item, index) => (
            <View
              key={item.id}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={[styles.tableCell, { flex: 1.15 }]}>
                {formatInvoiceDate(item.serviceDate ?? data.event.startDate)}
              </Text>
              <Text style={[styles.tableCell, { flex: 3.15 }]}>{item.description}</Text>
              <Text style={[styles.tableCell, { flex: 0.7, textAlign: "right" }]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, { flex: 1.2, textAlign: "right" }]}>
                {formatInvoiceCurrency(item.unitPrice)}
              </Text>
              <Text style={[styles.tableCell, { flex: 1.2, textAlign: "right" }]}>
                {formatInvoiceCurrency(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {data.payments.length > 0 && (
          <View style={styles.table}>
            <View
              style={[
                styles.tableHeader,
                { backgroundColor: data.branding.accentColor },
              ]}
            >
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Payment Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Type</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Method</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Notes</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.1, textAlign: "right" }]}>Amount</Text>
            </View>
            {data.payments.map((payment, index) => (
              <View
                key={payment.id}
                style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
              >
                <Text style={[styles.tableCell, { flex: 1.2 }]}>
                  {formatInvoiceDate(payment.paymentDate)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.4 }]}>
                  {paymentTypeLabel[payment.type] ?? payment.type}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.4 }]}>
                  {payment.paymentMethod ?? "-"}
                </Text>
                <Text style={[styles.tableCell, { flex: 2.2 }]}>
                  {payment.notes ?? "-"}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.1, textAlign: "right" }]}>
                  {formatInvoiceCurrency(payment.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total in words</Text>
            <Text style={styles.summaryValue}>{amountInWords}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatInvoiceCurrency(data.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount paid</Text>
            <Text style={styles.summaryValue}>{formatInvoiceCurrency(data.totalPaid)}</Text>
          </View>
          <View
            style={[
              styles.summaryDueRow,
              { backgroundColor: data.branding.accentColor },
            ]}
          >
            <Text style={styles.summaryDueLabel}>Balance due</Text>
            <Text style={styles.summaryDueValue}>
              {formatInvoiceCurrency(data.balanceDue)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentRow}>
          <View style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>Digital Payment</Text>
            {data.paymentQrDataUrl ? (
              <>
                <Image src={data.paymentQrDataUrl} style={styles.qrImage} />
                <Text style={styles.qrCaption}>
                  Scan to pay the outstanding balance of {formatInvoiceCurrency(data.balanceDue)}.
                </Text>
                {data.branding.upiId && (
                  <Text style={styles.qrCaption}>UPI: {data.branding.upiId}</Text>
                )}
              </>
            ) : (
              <Text style={styles.qrCaption}>
                Add a UPI ID in invoice branding settings to enable scan-to-pay QR codes.
              </Text>
            )}
          </View>
          <View style={styles.sectionCardSpacer} />
          <View style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            {data.branding.bankName && (
              <Text style={styles.bankLine}>Bank: {data.branding.bankName}</Text>
            )}
            {data.branding.bankAccountName && (
              <Text style={styles.bankLine}>
                Account name: {data.branding.bankAccountName}
              </Text>
            )}
            {data.branding.bankAccountNumber && (
              <Text style={styles.bankLine}>
                Account number: {data.branding.bankAccountNumber}
              </Text>
            )}
            {data.branding.bankIfsc && (
              <Text style={styles.bankLine}>IFSC: {data.branding.bankIfsc}</Text>
            )}
            {data.branding.paymentNotes && (
              <Text style={styles.bankLine}>{data.branding.paymentNotes}</Text>
            )}
          </View>
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Terms and Notes</Text>
          <Text style={styles.footerText}>
            {data.branding.paymentTerms ?? "Payment terms are available on request."}
          </Text>
          {data.event.notes && (
            <Text style={styles.footerText}>Event note: {data.event.notes}</Text>
          )}
          <Text style={styles.footerText}>
            Thank you for choosing {data.branding.organizationName}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
