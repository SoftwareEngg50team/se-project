"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { User, Mail, Calendar, MapPin } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import { Button } from "@se-project/ui/components/button";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";

interface StaffDetailViewProps {
  paramsPromise: Promise<{ id: string }>;
}

type AssignedEvent = {
  id: string;
  eventId: string;
  assignedAt: string | Date;
  event: {
    id: string;
    name: string;
    startDate: string | Date;
    endDate: string | Date;
    location: string;
    status: string;
  };
};

type AttendanceRecord = {
  id: string;
  eventId: string;
  date: string | Date;
  present: boolean;
  hoursWorked: number | null;
  event: {
    id: string;
    name: string;
  };
};

const eventColumns: ColumnDef<AssignedEvent, unknown>[] = [
  {
    accessorKey: "event.name",
    header: "Event",
    cell: ({ row }) => (
      <Link
        href={`/events/${row.original.eventId}`}
        className="font-medium hover:underline"
      >
        {row.original.event.name}
      </Link>
    ),
  },
  {
    accessorKey: "event.startDate",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.event.startDate).toLocaleDateString(),
  },
  {
    accessorKey: "event.location",
    header: "Location",
    cell: ({ row }) => row.original.event.location,
  },
  {
    accessorKey: "event.status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.event.status} />,
  },
  {
    accessorKey: "assignedAt",
    header: "Assigned",
    cell: ({ row }) =>
      new Date(row.original.assignedAt).toLocaleDateString(),
  },
];

const attendanceColumns: ColumnDef<AttendanceRecord, unknown>[] = [
  {
    accessorKey: "event.name",
    header: "Event",
    cell: ({ row }) => (
      <Link
        href={`/events/${row.original.eventId}`}
        className="font-medium hover:underline"
      >
        {row.original.event.name}
      </Link>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) =>
      new Date(row.original.date).toLocaleDateString(),
  },
  {
    accessorKey: "present",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.present ? "completed" : "cancelled"} />
    ),
  },
  {
    accessorKey: "hoursWorked",
    header: "Hours Worked",
    cell: ({ row }) =>
      row.original.hoursWorked != null ? `${row.original.hoursWorked}h` : "-",
  },
];

export function StaffDetailView({ paramsPromise }: StaffDetailViewProps) {
  const { id } = use(paramsPromise);

  const { data: userData, isLoading: isLoadingUser } = useQuery(
    orpc.staff.getById.queryOptions({ input: { id } }),
  );

  const { data: assignments, isLoading: isLoadingAssignments } = useQuery(
    orpc.staffAssignments.getByStaff.queryOptions({ input: { userId: id } }),
  );

  const { data: attendanceRecords, isLoading: isLoadingAttendance } = useQuery(
    orpc.attendance.getByStaff.queryOptions({ input: { userId: id } }),
  );

  if (isLoadingUser) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading staff member...</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Staff member not found.</p>
      </div>
    );
  }

  const assignedEvents = (assignments ?? []) as AssignedEvent[];
  const attendanceData = (attendanceRecords ?? []) as AttendanceRecord[];

  return (
    <div className="space-y-8">
      <PageHeader title={userData.name}>
        <StatusBadge status={userData.role ?? "unknown"} />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">
                  {userData.name}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">
                  {userData.email}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Joined</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(userData.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Events</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoadingAssignments && assignedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No event assignments found.
            </p>
          ) : (
            <DataTable
              columns={eventColumns}
              data={assignedEvents}
              isLoading={isLoadingAssignments}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoadingAttendance && attendanceData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance records found.
            </p>
          ) : (
            <DataTable
              columns={attendanceColumns}
              data={attendanceData}
              isLoading={isLoadingAttendance}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
