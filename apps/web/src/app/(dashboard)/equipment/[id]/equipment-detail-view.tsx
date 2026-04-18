"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Package, Calendar, Tag, StickyNote, Pencil } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@se-project/ui/components/select";
import { Separator } from "@se-project/ui/components/separator";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { EquipmentCategoryIcon } from "@/components/shared/equipment-category-icon";

interface EquipmentDetailViewProps {
  paramsPromise: Promise<{ id: string }>;
}

type EquipmentStatus =
  | "available"
  | "assigned"
  | "in_transit"
  | "at_event"
  | "under_repair";

type Assignment = {
  id: string;
  eventId: string;
  equipmentId: string;
  assignedAt: string | Date;
  returnedAt: string | Date | null;
  returnStatus: string | null;
  damageNotes: string | null;
  assignedBy: string;
  event: {
    id: string;
    name: string;
  };
  assignedByUser: {
    id: string;
    name: string;
  } | null;
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(paise: number): string {
  return `\u20B9${(paise / 100).toFixed(2)}`;
}

const assignmentColumns: ColumnDef<Assignment, unknown>[] = [
  {
    accessorKey: "event.name",
    header: "Event",
    cell: ({ row }) => (
      <Link
        href={`/events/${row.original.eventId}`}
        className="font-medium hover:underline"
      >
        {row.original.event?.name ?? "-"}
      </Link>
    ),
  },
  {
    accessorKey: "assignedAt",
    header: "Assigned",
    cell: ({ row }) => formatDate(row.original.assignedAt),
  },
  {
    accessorKey: "returnedAt",
    header: "Returned",
    cell: ({ row }) =>
      row.original.returnedAt
        ? formatDate(row.original.returnedAt)
        : "-",
  },
  {
    accessorKey: "returnStatus",
    header: "Return Status",
    cell: ({ row }) =>
      row.original.returnStatus ? (
        <StatusBadge status={row.original.returnStatus} />
      ) : (
        <StatusBadge status="pending" />
      ),
  },
  {
    accessorKey: "assignedByUser.name",
    header: "Assigned By",
    cell: ({ row }) => row.original.assignedByUser?.name ?? "-",
  },
  {
    accessorKey: "damageNotes",
    header: "Damage Notes",
    cell: ({ row }) => row.original.damageNotes ?? "-",
  },
];

export function EquipmentDetailView({
  paramsPromise,
}: EquipmentDetailViewProps) {
  const { id } = use(paramsPromise);
  const queryClient = useQueryClient();

  const { data: equipment, isLoading } = useQuery(
    orpc.equipment.getById.queryOptions({ input: { id } }),
  );

  const updateStatus = useMutation(
    orpc.equipment.updateStatus.mutationOptions(),
  );

  const handleStatusUpdate = async (newStatus: EquipmentStatus) => {
    await updateStatus.mutateAsync(
      { id, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: orpc.equipment.getById.queryOptions({ input: { id } }).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: [["equipment", "list"]],
          });
          toast.success("Equipment status updated");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to update status");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading equipment...</p>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Equipment not found.</p>
      </div>
    );
  }

  const assignments = (equipment.assignments ?? []) as Assignment[];

  return (
    <div className="space-y-8">
      <PageHeader title={equipment.name}>
        <StatusBadge status={equipment.status} />
        <Select
          value={equipment.status}
          onValueChange={(value) =>
            handleStatusUpdate(value as EquipmentStatus)
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue>
              {{ available: "Available", assigned: "Assigned", in_transit: "In Transit", at_event: "At Event", under_repair: "Under Repair" }[equipment.status]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="at_event">At Event</SelectItem>
            <SelectItem value="under_repair">Under Repair</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" render={<Link href={`/equipment/${id}/edit` as any} />}>
            <Pencil className="mr-2 size-4" />
            Edit
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Tag className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Category</p>
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  {equipment.category ? (
                    <>
                      <EquipmentCategoryIcon name={equipment.category.name} className="size-4 text-primary" />
                      {equipment.category.name}
                    </>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 size-5 text-primary/70" />
              <div>
                <p className="text-sm font-medium">Status</p>
                <StatusBadge status={equipment.status} />
              </div>
            </div>
            {equipment.purchaseDate && (
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 size-5 text-primary/70" />
                <div>
                  <p className="text-sm font-medium">Purchase Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(equipment.purchaseDate)}
                  </p>
                </div>
              </div>
            )}
            {equipment.purchaseCost != null && (
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 size-5 text-primary/70" />
                <div>
                  <p className="text-sm font-medium">Purchase Cost</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(equipment.purchaseCost)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {equipment.notes && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <StickyNote className="mt-0.5 size-5 text-primary/70" />
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {equipment.notes}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assignment history for this equipment.
            </p>
          ) : (
            <DataTable
              columns={assignmentColumns}
              data={assignments}
              isLoading={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
