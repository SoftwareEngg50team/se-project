"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Package } from "lucide-react";
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
import { EquipmentCategoryIcon } from "@/components/shared/equipment-category-icon";

type EquipmentItem = {
  id: string;
  name: string;
  categoryId: string;
  status: string;
  purchaseDate: string | Date | null;
  purchaseCost: number | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  category: {
    id: string;
    name: string;
    description: string | null;
  };
};

const columns: ColumnDef<EquipmentItem, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/equipment/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "category.name",
    header: "Category",
    cell: ({ row }) =>
      row.original.category ? (
        <span className="inline-flex items-center gap-2">
          <EquipmentCategoryIcon name={row.original.category.name} className="size-4 text-primary" />
          {row.original.category.name}
        </span>
      ) : (
        "-"
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "purchaseDate",
    header: "Purchase Date",
    cell: ({ row }) => {
      const date = row.getValue("purchaseDate") as string | null;
      return date ? new Date(date).toLocaleDateString() : "-";
    },
  },
  {
    accessorKey: "purchaseCost",
    header: "Cost",
    cell: ({ row }) => {
      const cost = row.getValue("purchaseCost") as number | null;
      return cost != null ? `\u20B9${(cost / 100).toFixed(2)}` : "-";
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/equipment/${row.original.id}`} />}>
        View
      </Button>
    ),
  },
];

type StatusFilter =
  | "all"
  | "available"
  | "assigned"
  | "in_transit"
  | "at_event"
  | "under_repair";

export function EquipmentListView() {
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data, isLoading } = useQuery(
    orpc.equipment.list.queryOptions({
      input: {
        status: filterStatus === "all" ? undefined : filterStatus,
        categoryId: filterCategory === "all" ? undefined : filterCategory,
      },
    }),
  );

  const { data: categories } = useQuery(
    orpc.equipment.listCategories.queryOptions(),
  );

  const items = (data?.items ?? []) as EquipmentItem[];

  return (
    <div className="space-y-8">
      <PageHeader title="Equipment" description="Manage your equipment inventory">
        <Button render={<Link href="/equipment/new" />}>
            <Plus className="mr-2 size-4" />
            New Equipment
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <Select
          value={filterStatus}
          onValueChange={(value) => setFilterStatus(value as StatusFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status">
              {{ all: "All Statuses", available: "Available", assigned: "Assigned", in_transit: "In Transit", at_event: "At Event", under_repair: "Under Repair" }[filterStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="at_event">At Event</SelectItem>
            <SelectItem value="under_repair">Under Repair</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterCategory}
          onValueChange={(value) => setFilterCategory(value ?? "")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category">
              {filterCategory === "all" ? "All Categories" : (categories ?? []).find((c) => c.id === filterCategory)?.name ?? "Filter by category"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(categories ?? []).map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="inline-flex items-center gap-2">
                  <EquipmentCategoryIcon name={cat.name} className="size-4 text-primary" />
                  {cat.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No equipment found"
          description="Get started by adding your first equipment item."
        >
          <Button render={<Link href="/equipment/new" />}>
              <Plus className="mr-2 size-4" />
              New Equipment
          </Button>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchKey="name"
          searchPlaceholder="Search equipment..."
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
