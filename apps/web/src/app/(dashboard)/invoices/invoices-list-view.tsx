"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "@tanstack/react-form";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
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
import { Checkbox } from "@se-project/ui/components/checkbox";
import { toast } from "sonner";
import z from "zod";
import { orpc } from "@/utils/orpc";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";

function formatCurrency(paise: number): string {
  return `\u20B9${(paise / 100).toFixed(2)}`;
}

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  eventId: string;
  amount: number;
  status: string;
  issuedAt: string | Date;
  dueDate: string | Date;
  event: {
    id: string;
    name: string;
  } | null;
  payments: Array<{ id: string; amount: number }>;
};

const columns: ColumnDef<InvoiceRow, unknown>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice #",
    cell: ({ row }) => (
      <Link
        href={`/invoices/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("invoiceNumber")}
      </Link>
    ),
  },
  {
    accessorKey: "event.name",
    header: "Event",
    cell: ({ row }) => {
      const event = row.original.event;
      return event ? (
        <Link
          href={`/events/${event.id}`}
          className="hover:underline"
        >
          {event.name}
        </Link>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatCurrency(row.getValue("amount")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "dueDate",
    header: "Due Date",
    cell: ({ row }) =>
      new Date(row.original.dueDate).toLocaleDateString("en-IN"),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/invoices/${row.original.id}`} />}>
        View
      </Button>
    ),
  },
];

type StatusFilter = "all" | "draft" | "sent" | "partial" | "paid" | "overdue";

const createInvoiceSchema = z.object({
  eventId: z.string().min(1, "Event is required"),
  dueDate: z.string().min(1, "Due date is required"),
});

type InvoiceLineItemDraft = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  serviceDate: string;
};

function createLineItemDraft(): InvoiceLineItemDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    description: "",
    quantity: 1,
    unitPrice: "",
    serviceDate: "",
  };
}

export function InvoicesListView() {
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [showOverdue, setShowOverdue] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>([
    createLineItemDraft(),
  ]);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    orpc.invoices.list.queryOptions({
      input: {
        status: filterStatus === "all" ? undefined : filterStatus,
        overdueDays: showOverdue ? 15 : undefined,
        page: 1,
        limit: 100,
      },
    }),
  );

  const { data: eventsData } = useQuery(
    orpc.events.list.queryOptions({ input: { page: 1, limit: 100 } }),
  );

  const createInvoice = useMutation(
    orpc.invoices.create.mutationOptions(),
  );

  const form = useForm({
    defaultValues: {
      eventId: "",
      dueDate: "",
    },
    onSubmit: async ({ value }) => {
      const preparedLineItems = lineItems
        .map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          serviceDate: item.serviceDate,
        }))
        .filter((item) => item.description || item.unitPrice > 0);

      if (preparedLineItems.length === 0) {
        toast.error("Add at least one invoice line item");
        return;
      }

      if (
        preparedLineItems.some(
          (item) =>
            !item.description || item.quantity < 1 || item.unitPrice < 1,
        )
      ) {
        toast.error("Each line item needs a description, quantity, and unit price");
        return;
      }

      await createInvoice.mutateAsync(
        {
          eventId: value.eventId,
          amount: preparedLineItems.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          ),
          dueDate: new Date(value.dueDate),
          lineItems: preparedLineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            serviceDate: item.serviceDate
              ? new Date(item.serviceDate)
              : undefined,
          })),
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: [["invoices", "list"]],
            });
            setCreateOpen(false);
            form.reset();
            setLineItems([createLineItemDraft()]);
            toast.success("Invoice created successfully");
          },
          onError: (error) => {
            toast.error(error.message || "Failed to create invoice");
          },
        },
      );
    },
    validators: {
      onSubmit: createInvoiceSchema,
    },
  });

  const invoices = (data?.invoices ?? []) as InvoiceRow[];
  const events = eventsData?.events ?? [];
  const invoiceTotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * Number(item.unitPrice || 0),
    0,
  );

  function updateLineItem(
    id: string,
    key: keyof Omit<InvoiceLineItemDraft, "id">,
    value: string | number,
  ) {
    setLineItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  }

  function addLineItem() {
    setLineItems((current) => [...current, createLineItemDraft()]);
  }

  function removeLineItem(id: string) {
    setLineItems((current) =>
      current.length === 1
        ? [createLineItemDraft()]
        : current.filter((item) => item.id !== id),
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Invoices" description="Track invoices and payments">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create Invoice
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <Select
          value={filterStatus}
          onValueChange={(value) => setFilterStatus(value as StatusFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status">
              {{ all: "All Statuses", draft: "Draft", sent: "Sent", partial: "Partial", paid: "Paid", overdue: "Overdue" }[filterStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="overdue-toggle"
            checked={showOverdue}
            onCheckedChange={(checked) => setShowOverdue(checked === true)}
          />
          <Label htmlFor="overdue-toggle" className="text-sm font-normal cursor-pointer">
            Overdue (&gt;15 days)
          </Label>
        </div>
      </div>

      {!isLoading && invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices found"
          description="No invoices match the current filters."
        >
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create Invoice
          </Button>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          searchKey="invoiceNumber"
          searchPlaceholder="Search invoices..."
          isLoading={isLoading}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="eventId">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Event</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event">
                        {field.state.value ? (events.find((e) => e.id === field.state.value)?.name ?? "Select an event") : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((evt) => (
                        <SelectItem key={evt.id} value={evt.id}>
                          {evt.name}
                        </SelectItem>
                      ))}
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

            <form.Field name="dueDate">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Due Date</Label>
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Line Items</Label>
                  <p className="text-xs text-muted-foreground">
                    Build the invoice total from itemized services.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="mr-2 size-4" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">Line Item {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`description-${item.id}`}>Description</Label>
                        <Input
                          id={`description-${item.id}`}
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(item.id, "description", e.target.value)
                          }
                          placeholder="e.g., Stage lighting rental"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`quantity-${item.id}`}>Quantity</Label>
                        <Input
                          id={`quantity-${item.id}`}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              Math.max(1, Number(e.target.value) || 1),
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`unit-price-${item.id}`}>Unit Price (paise)</Label>
                        <Input
                          id={`unit-price-${item.id}`}
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "unitPrice",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`service-date-${item.id}`}>Service Date</Label>
                        <Input
                          id={`service-date-${item.id}`}
                          type="date"
                          value={item.serviceDate}
                          onChange={(e) =>
                            updateLineItem(item.id, "serviceDate", e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Line Total</Label>
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                          {formatCurrency(item.quantity * Number(item.unitPrice || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Invoice Total
                </p>
                <p className="text-lg font-semibold">{formatCurrency(invoiceTotal)}</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
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
                    {isSubmitting ? "Creating..." : "Create Invoice"}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
