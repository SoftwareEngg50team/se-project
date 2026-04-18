"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "@tanstack/react-form";
import { Store, Plus } from "lucide-react";
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
import { toast } from "sonner";
import z from "zod";
import { orpc } from "@/utils/orpc";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";

type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: string;
  createdAt: string | Date;
};

const columns: ColumnDef<VendorRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        href={`/vendors/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <StatusBadge status={row.getValue("type")} />,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => row.original.phone || "-",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email || "-",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/vendors/${row.original.id}`} />}>
        View
      </Button>
    ),
  },
];

type TypeFilter = "all" | "food" | "transportation" | "repair" | "other";

const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string(),
  email: z.string(),
  type: z.enum(["food", "transportation", "repair", "other"]),
});

export function VendorsListView() {
  const searchParams = useSearchParams();
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery(
    orpc.vendors.list.queryOptions({
      input: {
        type: filterType === "all" ? undefined : filterType,
        page: 1,
        limit: 100,
      },
    }),
  );

  const createVendor = useMutation(
    orpc.vendors.create.mutationOptions(),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      type: "other" as "food" | "transportation" | "repair" | "other",
    },
    onSubmit: async ({ value }) => {
      await createVendor.mutateAsync(
        {
          name: value.name,
          phone: value.phone || undefined,
          email: value.email || undefined,
          type: value.type,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: [["vendors", "list"]],
            });
            setCreateOpen(false);
            form.reset();
            toast.success("Vendor created successfully");
          },
          onError: (error) => {
            toast.error(error.message || "Failed to create vendor");
          },
        },
      );
    },
    validators: {
      onSubmit: createVendorSchema,
    },
  });

  const vendors = (data?.vendors ?? []) as VendorRow[];

  return (
    <div className="space-y-8">
      <PageHeader title="Vendors" description="Manage vendor relationships">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add Vendor
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <Select
          value={filterType}
          onValueChange={(value) => setFilterType(value as TypeFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type">
              {{ all: "All Types", food: "Food", transportation: "Transportation", repair: "Repair", other: "Other" }[filterType]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="food">Food</SelectItem>
            <SelectItem value="transportation">Transportation</SelectItem>
            <SelectItem value="repair">Repair</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No vendors found"
          description="No vendors match the current filters."
        >
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Vendor
          </Button>
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={vendors}
          searchKey="name"
          searchPlaceholder="Search vendors..."
          isLoading={isLoading}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vendor</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Name</Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter vendor name"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="type">
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
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Phone</Label>
                  <Input
                    id={field.name}
                    type="tel"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
              )}
            </form.Field>

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
                    {isSubmitting ? "Creating..." : "Add Vendor"}
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
