"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Calendar } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@se-project/ui/components/select";
import { orpc } from "@/utils/orpc";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";

type Event = {
  id: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  location: string;
  status: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string | null;
  totalRevenue: number | null;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const columns: ColumnDef<Event, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/events/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "startDate",
    header: "Date",
    cell: ({ row }) => new Date(row.getValue("startDate")).toLocaleDateString(),
  },
  {
    accessorKey: "location",
    header: "Location",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "clientName",
    header: "Client",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/events/${row.original.id}`} />}>
        View
      </Button>
    ),
  },
];

type StatusFilter =
  | "all"
  | "upcoming"
  | "in_progress"
  | "completed"
  | "cancelled";

export function EventsListView() {
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery(
    orpc.events.list.queryOptions({
      input: { status: filterStatus === "all" ? undefined : filterStatus },
    }),
  );

  const events = (data?.events ?? []) as Event[];

  return (
    <div className="space-y-8">
      <PageHeader title="Events" description="Manage your events">
        <Button render={<Link href="/events/new" />}>
            <Plus className="mr-2 size-4" />
            New Event
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <Select
          value={filterStatus}
          onValueChange={(value) => setFilterStatus(value as StatusFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status">
              {{ all: "All Statuses", upcoming: "Upcoming", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" }[filterStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events found"
          description="Get started by creating your first event."
        >
          <Button render={<Link href="/events/new" />}>
              <Plus className="mr-2 size-4" />
              New Event
          </Button>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={events}
          searchKey="name"
          searchPlaceholder="Search events..."
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
