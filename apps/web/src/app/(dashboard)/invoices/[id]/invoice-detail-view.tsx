"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "@tanstack/react-form";
import {
  FileText,
  Calendar,
  IndianRupee,
  CreditCard,
  Plus,
  User,
  Download,
  Sheet,
  QrCode,
  Landmark,
  Send,
} from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import { Textarea } from "@se-project/ui/components/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@se-project/ui/components/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@se-project/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@se-project/ui/components/dialog";
import { toast } from "sonner";
import z from "zod";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { DataTable } from "@/components/shared/data-table";

function formatCurrency(paise: number): string {
  return `\u20B9${(paise / 100).toFixed(2)}`;
}

interface InvoiceDetailViewProps {
  paramsPromise: Promise<{ id: string }>;
}

type PaymentRow = {
  id: string;
  amount: number;
  paymentDate: string | Date;
  paymentMethod: string | null;
  type: string;
  notes: string | null;
};

type LineItemRow = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  serviceDate: string | Date | null;
  sortOrder: number;
};

const paymentColumns: ColumnDef<PaymentRow, unknown>[] = [
  {
    accessorKey: "paymentDate",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.paymentDate).toLocaleDateString("en-IN"),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatCurrency(row.getValue("amount")),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <StatusBadge status={row.getValue("type")} />,
  },
  {
    accessorKey: "paymentMethod",
    header: "Method",
    cell: ({ row }) => row.original.paymentMethod || "-",
  },
  {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ row }) => row.original.notes || "-",
  },
];

const recordPaymentSchema = z.object({
  amount: z.string().refine(
    (val) => /^\d+$/.test(val) && Number(val) >= 1,
    { message: "Amount must be at least 1 paise" },
  ),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentMethod: z.string(),
  type: z.enum(["customer_advance", "customer_payment", "vendor_payment"]),
  notes: z.string(),
});

export function InvoiceDetailView({ paramsPromise }: InvoiceDetailViewProps) {
  const { id } = use(paramsPromise);
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  const { data: invoiceData, isLoading } = useQuery(
    orpc.invoices.getById.queryOptions({ input: { id } }),
  );

  const { data: profileData } = useQuery(orpc.profile.getMine.queryOptions());

  const recordPayment = useMutation(
    orpc.payments.recordPayment.mutationOptions(),
  );

  const updateInvoice = useMutation(
    orpc.invoices.update.mutationOptions(),
  );

  const sendInvoice = useMutation({
    mutationFn: async (input: { to: string; subject: string; message: string }) => {
      const response = await fetch(`/api/invoices/${id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invoice");
      }

      return data;
    },
  });

  const form = useForm({
    defaultValues: {
      amount: "",
      paymentDate: new Date().toISOString().split("T")[0]!,
      paymentMethod: "",
      type: "customer_payment" as "customer_advance" | "customer_payment" | "vendor_payment",
      notes: "",
    },
    onSubmit: async ({ value }) => {
      if (!invoiceData) return;
      const amount = Number(value.amount);
      await recordPayment.mutateAsync(
        {
          eventId: invoiceData.eventId,
          invoiceId: id,
          amount,
          paymentDate: new Date(value.paymentDate),
          paymentMethod: value.paymentMethod || undefined,
          type: value.type,
          notes: value.notes || undefined,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: orpc.invoices.getById.queryOptions({ input: { id } }).queryKey,
            });
            queryClient.invalidateQueries({
              queryKey: [["invoices", "list"]],
            });
            queryClient.invalidateQueries({
              queryKey: [["payments", "list"]],
            });
            setPaymentDialogOpen(false);
            form.reset();
            toast.success("Payment recorded successfully");
          },
          onError: (error) => {
            toast.error(error.message || "Failed to record payment");
          },
        },
      );
    },
    validators: {
      onSubmit: recordPaymentSchema,
    },
  });

  const handleStatusChange = async (newStatus: string) => {
    await updateInvoice.mutateAsync(
      {
        id,
        status: newStatus as "draft" | "sent" | "partial" | "paid" | "overdue",
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: orpc.invoices.getById.queryOptions({ input: { id } }).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: [["invoices", "list"]],
          });
          toast.success("Invoice status updated");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to update invoice status");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Invoice not found.</p>
      </div>
    );
  }

  const payments = (invoiceData.payments ?? []) as PaymentRow[];
  const lineItems = (invoiceData.lineItems ?? []) as LineItemRow[];
  const displayLineItems = lineItems.length > 0
    ? [...lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
    : [
        {
          id: `fallback-${id}`,
          description: `Event services - ${invoiceData.event?.name ?? "Services"}`,
          quantity: 1,
          unitPrice: invoiceData.amount,
          serviceDate: invoiceData.event?.startDate ?? invoiceData.issuedAt,
          sortOrder: 0,
        },
      ];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = invoiceData.amount - totalPaid;
  const hasUpi = Boolean(profileData?.paymentSettings.upiId?.trim());
  const hasBank = Boolean(profileData?.paymentSettings.bankName?.trim() || profileData?.paymentSettings.bankAccountNumber?.trim());

  const defaultRecipient = invoiceData.event?.clientEmail || "";
  const defaultSubject = `Invoice ${invoiceData.invoiceNumber} for ${invoiceData.event?.name ?? "your event"}`;

  return (
    <div className="space-y-8">
      <PageHeader title={invoiceData.invoiceNumber}>
        <StatusBadge status={invoiceData.status} />
        <a href={`/api/invoices/${id}/pdf`} download>
          <Button size="sm" variant="outline">
            <Download className="mr-2 size-4" />
            PDF
          </Button>
        </a>
        <a href={`/api/invoices/${id}/excel`} download>
          <Button size="sm" variant="outline">
            <Sheet className="mr-2 size-4" />
            Excel
          </Button>
        </a>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSendTo(defaultRecipient);
            setSendSubject(defaultSubject);
            setSendMessage(
              `Please find attached invoice ${invoiceData.invoiceNumber}.`,
            );
            setSendDialogOpen(true);
          }}
        >
          <Send className="mr-2 size-4" />
          Send Invoice
        </Button>
        {invoiceData.status === "draft" && (
          <Button
            size="sm"
            onClick={() => handleStatusChange("sent")}
            disabled={updateInvoice.isPending}
          >
            Mark as Sent
          </Button>
        )}
        {invoiceData.status !== "paid" && (
          <Button
            size="sm"
            onClick={() => setPaymentDialogOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Record Payment
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Invoice Amount"
          value={formatCurrency(invoiceData.amount)}
          icon={IndianRupee}
          description="Total invoice amount"
        />
        <StatsCard
          title="Total Paid"
          value={formatCurrency(totalPaid)}
          icon={CreditCard}
          description={`${payments.length} payment(s) received`}
        />
        <StatsCard
          title="Remaining"
          value={formatCurrency(Math.max(0, remaining))}
          icon={FileText}
          description={remaining <= 0 ? "Fully paid" : "Outstanding balance"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Options for This Invoice</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <QrCode className="size-4 text-primary" />
              UPI / QR Payment
            </p>
            {hasUpi ? (
              <p className="text-sm text-muted-foreground">
                UPI is configured. Export this invoice as PDF to show a scannable QR code automatically.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                UPI is not configured yet. Add a UPI ID in Profile &amp; Settings to enable QR payments.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Landmark className="size-4 text-primary" />
              Bank Transfer
            </p>
            {hasBank ? (
              <p className="text-sm text-muted-foreground">
                Bank details are configured and will be included in PDF and Excel exports.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bank details are optional. Add them in Profile &amp; Settings to show transfer instructions.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Invoice Number</p>
                <p className="text-sm text-muted-foreground">
                  {invoiceData.invoiceNumber}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Issued At</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invoiceData.issuedAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Due Date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invoiceData.dueDate).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
            {invoiceData.event && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 size-5 text-primary/70" />
                <div>
                  <p className="text-sm font-medium">Event</p>
                  <Link
                    href={`/events/${invoiceData.event.id}`}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    {invoiceData.event.name}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayLineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.serviceDate
                      ? new Date(item.serviceDate).toLocaleDateString("en-IN")
                      : "-"}
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments recorded yet.
            </p>
          ) : (
            <DataTable columns={paymentColumns} data={payments} />
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="amount">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Amount (in paise)</Label>
                  <Input
                    id={field.name}
                    type="number"
                    inputMode="numeric"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter amount in paise"
                  />
                  <p className="text-xs text-muted-foreground">
                    Display value: {field.state.value ? formatCurrency(Number(field.state.value)) : "—"}
                  </p>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="paymentDate">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Payment Date</Label>
                  <Input
                    id={field.name}
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="type">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Payment Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as "customer_advance" | "customer_payment" | "vendor_payment")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type">
                        {field.state.value ? { customer_advance: "Customer Advance", customer_payment: "Customer Payment", vendor_payment: "Vendor Payment" }[field.state.value] : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_advance">Customer Advance</SelectItem>
                      <SelectItem value="customer_payment">Customer Payment</SelectItem>
                      <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="paymentMethod">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Payment Method</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g., UPI, Bank Transfer, Cash"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="notes">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Notes</Label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                  />
                </div>
              )}
            </form.Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button type="submit" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? "Recording..." : "Record Payment"}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Invoice by Gmail</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await sendInvoice.mutateAsync(
                  {
                    to: sendTo,
                    subject: sendSubject,
                    message: sendMessage,
                  },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({
                        queryKey: orpc.invoices.getById.queryOptions({ input: { id } }).queryKey,
                      });
                      queryClient.invalidateQueries({
                        queryKey: [["invoices", "list"]],
                      });
                      setSendDialogOpen(false);
                      toast.success("Invoice sent successfully");
                    },
                    onError: (error) => {
                      toast.error(error.message || "Failed to send invoice");
                    },
                  },
                );
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="send-to">Recipient Email</Label>
                <Input
                  id="send-to"
                  type="email"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-subject">Subject</Label>
                <Input
                  id="send-subject"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  placeholder="Invoice subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-message">Message</Label>
                <Textarea
                  id="send-message"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Write a short message..."
                  rows={5}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSendDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sendInvoice.isPending || !sendTo.trim()}>
                  {sendInvoice.isPending ? "Sending..." : "Send Invoice"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
