"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, Plus } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@se-project/ui/components/dialog";
import { Card, CardContent } from "@se-project/ui/components/card";
import { toast } from "sonner";
import z from "zod";
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
  hourlyRate: number;
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
const addStaffSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["event_head", "staff"]),
});

export function StaffListView() {
  const [filterRole, setFilterRole] = useState<RoleFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    orpc.staff.list.queryOptions({
      input: { role: filterRole === "all" ? undefined : filterRole },
    }),
  );

  const { data: workload = [] } = useQuery(
    orpc.staff.workloadSummary.queryOptions(),
  );

  const addStaff = useMutation(orpc.staff.addByEmail.mutationOptions());
  const updateCompensation = useMutation(
    orpc.staff.updateCompensation.mutationOptions(),
  );

  const form = useForm({
    defaultValues: {
      email: "",
      role: "staff" as "staff" | "event_head",
    },
    onSubmit: async ({ value }) => {
      const parsed = addStaffSchema.safeParse(value);

      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid form values");
        return;
      }

      try {
        const result = await addStaff.mutateAsync(parsed.data);
        toast.success(result.message);
        setAddOpen(false);
        form.reset();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orpc.staff.list.queryOptions({ input: { role: filterRole === "all" ? undefined : filterRole } }).queryKey }),
          queryClient.invalidateQueries({ queryKey: orpc.staff.workloadSummary.queryOptions().queryKey }),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add staff";
        toast.error(message);
      }
    },
  });

  const users = (data?.users ?? []) as StaffUser[];

  const displayedRates = useMemo(() => {
    const mapped: Record<string, string> = {};
    for (const user of users) {
      mapped[user.id] =
        rateInputs[user.id] ??
        String(Number.isFinite(user.hourlyRate) ? user.hourlyRate : 0);
    }
    return mapped;
  }, [users, rateInputs]);

  const handleSaveRate = async (userId: string) => {
    const raw = displayedRates[userId] ?? "0";
    const parsed = Number.parseInt(raw, 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Hourly rate must be a non-negative integer (paise)");
      return;
    }

    await updateCompensation.mutateAsync(
      { userId, hourlyRate: parsed },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: orpc.staff.list.queryOptions({
              input: { role: filterRole === "all" ? undefined : filterRole },
            }).queryKey,
          });
          toast.success("Hourly rate updated");
        },
        onError: (error) =>
          toast.error(error.message || "Failed to update hourly rate"),
      },
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Staff" description="Manage staff members" />

      <div className="grid gap-4 md:grid-cols-3">
        {workload.slice(0, 3).map((member) => (
          <Card key={member.userId}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{member.name}</p>
              <p className="text-2xl font-semibold">{member.upcomingAssignments}</p>
              <p className="text-xs text-muted-foreground">Upcoming assignments ({member.totalAssignments} total)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
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

        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {!isLoading && users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff found"
          description="No users match the current filter."
        />
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={users}
            searchKey="name"
            searchPlaceholder="Search staff..."
            isLoading={isLoading}
          />

          <div className="rounded-xl border border-border/60 p-4">
            <p className="mb-3 text-sm font-medium">Compensation Controls (paise/hour)</p>
            <div className="grid gap-3 md:grid-cols-2">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.role ?? "staff"}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={displayedRates[user.id] ?? "0"}
                      onChange={(event) =>
                        setRateInputs((current) => ({
                          ...current,
                          [user.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveRate(user.id)}
                      disabled={updateCompensation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field
              name="email"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="staff@example.com"
                  />
                </div>
              )}
            />

            <form.Field
              name="role"
              children={(field) => (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as "staff" | "event_head")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="event_head">Event Head</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addStaff.isPending}>
                {addStaff.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
