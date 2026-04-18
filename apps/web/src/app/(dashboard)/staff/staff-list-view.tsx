"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
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

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  image: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const columns: ColumnDef<StaffUser, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/staff/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <StatusBadge status={row.getValue("role") ?? ""} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/staff/${row.original.id}`} />}>
        View
      </Button>
    ),
  },
];

type RoleFilter = "all" | "owner" | "event_head" | "staff";

export function StaffListView() {
  const [filterRole, setFilterRole] = useState<RoleFilter>("all");

  const { data, isLoading } = useQuery(
    orpc.staff.list.queryOptions({
      input: { role: filterRole === "all" ? undefined : filterRole },
    }),
  );

  const users = (data?.users ?? []) as StaffUser[];

  return (
    <div className="space-y-8">
      <PageHeader title="Staff" description="Manage staff members" />

      <div className="flex items-center gap-4">
        <Select
          value={filterRole}
          onValueChange={(value) => setFilterRole(value as RoleFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role">
              {{ all: "All Roles", owner: "Owner", event_head: "Event Head", staff: "Staff" }[filterRole]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="event_head">Event Head</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff found"
          description="No users match the current filter."
        />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchKey="name"
          searchPlaceholder="Search staff..."
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
