"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Store, Phone, Mail, Tag } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";

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

  const { data: vendorData, isLoading } = useQuery(
    orpc.vendors.getById.queryOptions({ input: { id } }),
  );

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
    </div>
  );
}
