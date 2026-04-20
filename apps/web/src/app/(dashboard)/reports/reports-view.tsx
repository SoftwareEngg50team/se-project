"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarCheck, IndianRupee, TrendingDown, TrendingUp, Users, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@se-project/ui/components/table";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { StatusBadge } from "@/components/shared/status-badge";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function maxValue(values: number[]): number {
  return Math.max(...values, 1);
}

function barWidth(value: number, total: number): string {
  return `${total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100))}%`;
}

const EQUIPMENT_STATUSES = ["available", "assigned", "in_transit", "at_event", "under_repair"] as const;

export function ReportsView() {
  const { data: summary, isLoading: summaryLoading } = useQuery(orpc.dashboard.getFinancialSummary.queryOptions());
  const { data: eventsData, isLoading: eventsLoading } = useQuery(orpc.events.list.queryOptions({ input: { page: 1, limit: 100 } }));
  const { data: equipmentData, isLoading: equipmentLoading } = useQuery(orpc.equipment.list.queryOptions({ input: { page: 1, limit: 100 } }));
  const { data: staffData, isLoading: staffLoading } = useQuery(orpc.staff.list.queryOptions({ input: { page: 1, limit: 100 } }));
  const { data: monthlyUtilization, isLoading: utilizationLoading } = useQuery(
    orpc.equipment.getMonthlyUtilization.queryOptions({ input: { months: 6 } }),
  );

  const events = eventsData?.events ?? [];
  const equipmentItems = equipmentData?.items ?? [];
  const staffMembers = staffData?.users ?? [];

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const outstandingInvoices = summary?.outstandingInvoices ?? 0;

  const topClients = useMemo(() => {
    const map = new Map<string, { clientName: string; revenue: number; events: number }>();

    for (const event of events) {
      const current = map.get(event.clientName) ?? { clientName: event.clientName, revenue: 0, events: 0 };
      current.revenue += event.totalRevenue ?? 0;
      current.events += 1;
      map.set(event.clientName, current);
    }

    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [events]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; revenue: number; events: number }>();

    for (const event of events) {
      const label = monthLabel(event.startDate);
      const current = map.get(label) ?? { label, revenue: 0, events: 0 };
      current.revenue += event.totalRevenue ?? 0;
      current.events += 1;
      map.set(label, current);
    }

    return [...map.values()].slice(-6);
  }, [events]);

  const equipmentCountByStatus = useMemo(() => {
    return EQUIPMENT_STATUSES.reduce((acc, status) => {
      acc[status] = equipmentItems.filter((item) => item.status === status).length;
      return acc;
    }, {} as Record<string, number>);
  }, [equipmentItems]);

  const workloadQueries = useQueries({
    queries: staffMembers.slice(0, 6).map((staff) =>
      orpc.staffAssignments.getByStaff.queryOptions({ input: { userId: staff.id } }),
    ),
  });

  const workloadRows = staffMembers.slice(0, 6).map((staff, index) => ({
    staff,
    assignments: workloadQueries[index]?.data ?? [],
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" description="View business reports, trends, and workforce distribution." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Revenue" value={summaryLoading ? "..." : formatRupees(totalRevenue)} icon={IndianRupee} />
        <StatsCard title="Total Expenses" value={summaryLoading ? "..." : formatRupees(totalExpenses)} icon={TrendingDown} />
        <StatsCard title="Net Profit" value={summaryLoading ? "..." : formatRupees(Math.abs(netProfit))} icon={TrendingUp} description={summaryLoading ? undefined : netProfit >= 0 ? "Profitable" : "Loss"} />
        <StatsCard title="Outstanding" value={summaryLoading ? "..." : formatRupees(outstandingInvoices)} icon={BarChart3} description="Unpaid invoices" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-5 text-primary" /> Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnalyticBar label="Revenue" value={totalRevenue} total={maxValue([totalRevenue, totalExpenses, outstandingInvoices])} tone="bg-emerald-500" />
            <AnalyticBar label="Expenses" value={totalExpenses} total={maxValue([totalRevenue, totalExpenses, outstandingInvoices])} tone="bg-orange-500" />
            <AnalyticBar label="Outstanding invoices" value={outstandingInvoices} total={maxValue([totalRevenue, totalExpenses, outstandingInvoices])} tone="bg-red-500" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="size-5 text-primary" /> Monthly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : monthlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No event history yet.</p>
            ) : (
              monthlyTrend.map((row) => (
                <div key={row.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground">{formatRupees(row.revenue)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60">
                    <div className="h-2 rounded-full bg-primary" style={{ width: barWidth(row.revenue, maxValue(monthlyTrend.map((entry) => entry.revenue))) }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{row.events} event(s)</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="size-5 text-primary" /> Top Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client data yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Client</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Events</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topClients.map((row) => (
                      <TableRow key={row.clientName}>
                        <TableCell className="font-medium">{row.clientName}</TableCell>
                        <TableCell>{row.events}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatRupees(row.revenue)}</TableCell>
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
            <CardTitle className="flex items-center gap-2 text-base"><Wrench className="size-5 text-primary" /> Equipment Utilization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {equipmentLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : equipmentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No equipment registered.</p>
            ) : (
              EQUIPMENT_STATUSES.map((status) => {
                const count = equipmentCountByStatus[status] ?? 0;
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <StatusBadge status={status} />
                      <span className="text-muted-foreground">{count} item(s)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60">
                      <div className="h-2 rounded-full bg-primary" style={{ width: barWidth(count, equipmentData?.total ?? 1) }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-5 text-primary" />
            Monthly Equipment Utilization (6 months)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {utilizationLoading ? (
            <p className="text-sm text-muted-foreground">Loading utilization report...</p>
          ) : !monthlyUtilization || monthlyUtilization.length === 0 ? (
            <p className="text-sm text-muted-foreground">No utilization data found.</p>
          ) : (
            <div className="space-y-4">
              {monthlyUtilization.map((row) => (
                <div key={row.monthKey} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.monthLabel}</span>
                    <span className="text-muted-foreground">
                      {row.uniqueEquipmentCount} items • {row.assignmentCount} assignments • {row.utilizationRate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, row.utilizationRate))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="size-5 text-primary" /> Staff Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {staffLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : workloadRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff members found.</p>
            ) : (
              workloadRows.map(({ staff, assignments }) => (
                <div key={staff.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{staff.name}</span>
                    <span className="text-muted-foreground">{assignments.length} assignment(s)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60">
                    <div className="h-2 rounded-full bg-violet-500" style={{ width: barWidth(assignments.length, maxValue(workloadRows.map((row) => row.assignments.length))) }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="size-5 text-primary" /> Event Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Event</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Client</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Revenue</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.slice(0, 8).map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium"><Link href={`/events/${event.id}`} className="hover:underline">{event.name}</Link></TableCell>
                        <TableCell>{event.clientName}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatRupees(event.totalRevenue ?? 0)}</TableCell>
                        <TableCell><StatusBadge status={event.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalyticBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{formatRupees(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: barWidth(value, total) }} />
      </div>
    </div>
  );
}