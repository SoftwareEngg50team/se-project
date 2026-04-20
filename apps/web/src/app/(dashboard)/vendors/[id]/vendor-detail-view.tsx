"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Mail, Pencil, Phone, Store, Tag } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@se-project/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@se-project/ui/components/dialog";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@se-project/ui/components/select";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";

const editVendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string(),
  email: z.string(),
  type: z.enum(["food", "transportation", "repair", "other"]),
});

function formatCurrency(paise: number): string {
  return `\u20B9${(paise / 100).toFixed(2)}`;
}

interface VendorDetailViewProps {
  paramsPromise: Promise<{ id: string }>;
}

type ExpenseRow = {
  id: string;
  eventId: string;
  category: string;
  amount: number;
  description: string | null;
  createdAt: string | Date;
  event: {
    id: string;
    name: string;
  } | null;
};

type PaymentRow = {
  id: string;
  eventId: string;
  amount: number;
  paymentDate: string | Date;
  paymentMethod: string | null;
  type: string;
  notes: string | null;
  event: {
    id: string;
    name: string;
  } | null;
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
};

const expenseColumns: ColumnDef<ExpenseRow, unknown>[] = [
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
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <StatusBadge status={row.getValue("category")} />,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatCurrency(row.getValue("amount")),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "-",
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString("en-IN"),
  },
];

const paymentColumns: ColumnDef<PaymentRow, unknown>[] = [
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
    accessorKey: "paymentDate",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.paymentDate).toLocaleDateString("en-IN"),
  },
  {
    accessorKey: "invoice.invoiceNumber",
    header: "Invoice",
    cell: ({ row }) => {
      const inv = row.original.invoice;
      return inv ? (
        <Link
          href={`/invoices/${inv.id}`}
          className="hover:underline"
        >
          {inv.invoiceNumber}
        </Link>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
];

export function VendorDetailView({ paramsPromise }: VendorDetailViewProps) {
  const { id } = use(paramsPromise);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: vendorData, isLoading } = useQuery(
    orpc.vendors.getById.queryOptions({ input: { id } }),
  );

  const updateVendor = useMutation(orpc.vendors.update.mutationOptions());

  const editForm = useForm({
    defaultValues: {
      name: vendorData?.name ?? "",
      phone: vendorData?.phone ?? "",
      email: vendorData?.email ?? "",
      type: (vendorData?.type ?? "other") as "food" | "transportation" | "repair" | "other",
    },
    onSubmit: async ({ value }) => {
      if (!vendorData) {
        return;
      }

      await updateVendor.mutateAsync(
        {
          id,
          name: value.name,
          phone: value.phone || undefined,
          email: value.email || undefined,
          type: value.type,
        },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: orpc.vendors.getById.queryOptions({ input: { id } }).queryKey,
            });
            await queryClient.invalidateQueries({
              queryKey: ["vendors", "list"],
            });
            setEditOpen(false);
            toast.success("Vendor updated successfully");
          },
          onError: (error) => {
            toast.error(error.message || "Failed to update vendor");
          },
        },
      );
    },
    validators: {
      onSubmit: editVendorSchema,
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading vendor...</p>
      </div>
    );
  }

  if (!vendorData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Vendor not found.</p>
      </div>
    );
  }

  const expenses = (vendorData.expenses ?? []) as ExpenseRow[];
  const payments = (vendorData.payments ?? []) as PaymentRow[];
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader title={vendorData.name}>
        <StatusBadge status={vendorData.type} />
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 size-4" />
          Edit Vendor
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Vendor Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">
                  {vendorData.name}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Tag className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Type</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {vendorData.type}
                </p>
              </div>
            </div>
            {vendorData.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 text-primary/70" />
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">
                    {vendorData.phone}
                  </p>
                </div>
              </div>
            )}
            {vendorData.email && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 text-primary/70" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    {vendorData.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">
              Total expenses across {expenses.length} record(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalPayments)}</div>
            <p className="text-xs text-muted-foreground">
              Total payments across {payments.length} record(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No expenses recorded for this vendor.
            </p>
          ) : (
            <DataTable columns={expenseColumns} data={expenses} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments recorded for this vendor.
            </p>
          ) : (
            <DataTable columns={paymentColumns} data={payments} />
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <editForm.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <Input
                    id={field.name}
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
            </editForm.Field>

            <editForm.Field name="type">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as "food" | "transportation" | "repair" | "other")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type">
                        {field.state.value ? { food: "Food", transportation: "Transportation", repair: "Repair", other: "Other" }[field.state.value] : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Phone</Label>
                  <Input
                    id={field.name}
                    type="tel"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </editForm.Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <editForm.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button type="submit" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </editForm.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
