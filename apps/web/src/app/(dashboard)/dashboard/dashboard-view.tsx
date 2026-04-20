"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  TrendingDown,
  TrendingUp,
  FileText,
  Store,
  CalendarDays,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
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
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { StatusBadge } from "@/components/shared/status-badge";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MetricRow({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const width = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{formatRupees(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function DashboardView() {
  const { data: summary, isLoading: summaryLoading } = useQuery(
    orpc.dashboard.getFinancialSummary.queryOptions(),
  );

  const { data: upcomingEvents, isLoading: eventsLoading } = useQuery(
    orpc.dashboard.getUpcomingEvents.queryOptions({ input: { limit: 5 } }),
  );

  const { data: recentPayments, isLoading: paymentsLoading } = useQuery(
    orpc.dashboard.getRecentActivity.queryOptions({ input: { limit: 10 } }),
  );

  const { data: overdueinvoicesData, isLoading: overdueInvoicesLoading } = useQuery(
    orpc.invoices.list.queryOptions({ input: { overdueDays: 15, page: 1, limit: 10 } }),
  );

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const outstandingInvoices = summary?.outstandingInvoices ?? 0;
  const vendorPayments = summary?.totalVendorPayments ?? 0;
  const customerPayments = summary?.totalCustomerPayments ?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const maxCashFlow = Math.max(
    totalRevenue,
    totalExpenses,
    customerPayments,
    vendorPayments,
    1,
  );

  const overdueInvoices = overdueinvoicesData?.invoices ?? [];
  const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Overview of your event management business">
        <Link
          href="/reports"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Open reports
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Revenue"
          value={summaryLoading ? "..." : formatRupees(totalRevenue)}
          icon={IndianRupee}
        />
        <StatsCard
          title="Total Expenses"
          value={summaryLoading ? "..." : formatRupees(totalExpenses)}
          icon={TrendingDown}
        />
        <StatsCard
          title="Net Profit"
          value={summaryLoading ? "..." : formatRupees(Math.abs(netProfit))}
          icon={TrendingUp}
          description={
            summaryLoading ? undefined : netProfit >= 0 ? "Positive margin" : "Current loss"
          }
        />
        <StatsCard
          title="Outstanding Invoices"
          value={summaryLoading ? "..." : formatRupees(outstandingInvoices)}
          icon={FileText}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="size-5 text-primary" />
              Financial Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <MetricRow label="Revenue" value={totalRevenue} max={maxCashFlow} tone="bg-emerald-500" />
            <MetricRow label="Expenses" value={totalExpenses} max={maxCashFlow} tone="bg-orange-500" />
            <MetricRow label="Customer receipts" value={customerPayments} max={maxCashFlow} tone="bg-sky-500" />
            <MetricRow label="Vendor payments" value={vendorPayments} max={maxCashFlow} tone="bg-violet-500" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-5 text-primary" />
              Upcoming Events
            </CardTitle>
            <Link
              href="/events"
              className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !upcomingEvents || upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="group flex items-center justify-between rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium group-hover:text-primary">
                        {event.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.startDate)} · {event.location}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="size-5 text-primary" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !recentPayments || recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent payments</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Event</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.slice(0, 5).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Link
                            href={`/events/${payment.eventId}`}
                            className="transition-colors hover:text-primary"
                          >
                            {payment.event?.name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-medium">
                          {formatRupees(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={payment.type} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-5 text-primary" />
              Cash Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow
              label="Open invoices"
              value={outstandingInvoices}
              max={Math.max(totalRevenue, 1)}
              tone="bg-red-500"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SmallStat label="Customer receipts" value={formatRupees(customerPayments)} />
              <SmallStat label="Vendor disbursements" value={formatRupees(vendorPayments)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {overdueInvoices.length > 0 && (
        <Card className="shadow-sm border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <AlertCircle className="size-5" />
              Overdue Invoices (15+ days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                {overdueInvoices.length} invoice{overdueInvoices.length > 1 ? "s" : ""} • Total: {formatRupees(totalOverdueAmount)}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Invoice</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Event</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-red-50 dark:hover:bg-red-950/20">
                      <TableCell className="text-xs">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium text-red-600 dark:text-red-400 hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Link
                          href={`/events/${inv.eventId}`}
                          className="transition-colors hover:text-primary"
                        >
                          {inv.event?.name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-medium">
                        {formatRupees(inv.amount ?? 0)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}