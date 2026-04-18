"use client";

import { use, useState, type ComponentType } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Check,
  IndianRupee,
  Pencil,
  Plus,
  Package,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@se-project/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { Checkbox } from "@se-project/ui/components/checkbox";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@se-project/ui/components/select";
import { Separator } from "@se-project/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@se-project/ui/components/tabs";
import { Textarea } from "@se-project/ui/components/textarea";
import { Badge } from "@se-project/ui/components/badge";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";

interface EventDetailViewProps {
  paramsPromise: Promise<{ id: string }>;
}

type EventStatus = "upcoming" | "in_progress" | "completed" | "cancelled";

type EquipmentAssignmentRow = {
  id: string;
  eventId: string;
  equipmentId: string;
  assignedAt: string | Date;
  returnedAt: string | Date | null;
  returnStatus: string | null;
  damageNotes: string | null;
  equipment: {
    id: string;
    name: string;
    status: string;
    category: { name: string };
  };
  assignedByUser: { name: string } | null;
};

type StaffAssignmentRow = {
  id: string;
  eventId: string;
  userId: string;
  assignedAt: string | Date;
  user: { id: string; name: string; email: string; image: string | null };
};

type AttendanceRow = {
  id: string;
  eventId: string;
  userId: string;
  date: string | Date;
  present: boolean;
  hoursWorked: number | null;
  user: { id: string; name: string; email: string };
};

type ExpenseRow = {
  id: string;
  eventId: string;
  category: string;
  amount: number;
  description: string | null;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  createdAt: string | Date;
};

type PaymentRow = {
  id: string;
  amount: number;
  paymentDate: string | Date;
  paymentMethod: string | null;
  type: string;
  notes: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  issuedAt: string | Date;
  dueDate: string | Date;
};

type AvailableEquipment = {
  id: string;
  name: string;
  status: string;
  category: { name: string };
};

type AvailableStaff = {
  id: string;
  name: string;
  email: string;
  role: string | null;
};

const statusTransitions: Record<EventStatus, { label: string; next: EventStatus }[]> = {
  upcoming: [
    { label: "Start Event", next: "in_progress" },
    { label: "Cancel Event", next: "cancelled" },
  ],
  in_progress: [
    { label: "Complete Event", next: "completed" },
    { label: "Cancel Event", next: "cancelled" },
  ],
  completed: [],
  cancelled: [],
};

const expenseCategories = [
  "salary",
  "food",
  "transportation",
  "equipment_repair",
  "miscellaneous",
] as const;

const returnStatuses = ["returned", "missing", "damaged"] as const;

function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN");
}

export function EventDetailView({ paramsPromise }: EventDetailViewProps) {
  const { id } = use(paramsPromise);
  const queryClient = useQueryClient();
  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, boolean>>({});
  const [selectedStaff, setSelectedStaff] = useState<Record<string, boolean>>({});
  const [attendanceForm, setAttendanceForm] = useState({ userId: "", date: new Date().toISOString().slice(0, 10), present: true, hoursWorked: "" });
  const [expenseForm, setExpenseForm] = useState({ category: "miscellaneous", amount: "", description: "", vendorId: "" });
  const [returnDrafts, setReturnDrafts] = useState<Record<string, { returnStatus: typeof returnStatuses[number]; damageNotes: string }>>({});

  const eventQuery = useQuery(orpc.events.getById.queryOptions({ input: { id } }));
  const summaryQuery = useQuery(orpc.events.getEventSummary.queryOptions({ input: { id } }));
  const equipmentAssignmentsQuery = useQuery(orpc.equipmentAssignments.getByEvent.queryOptions({ input: { eventId: id } }));
  const staffAssignmentsQuery = useQuery(orpc.staffAssignments.getByEvent.queryOptions({ input: { eventId: id } }));
  const attendanceQuery = useQuery(orpc.attendance.getByEvent.queryOptions({ input: { eventId: id } }));
  const expensesQuery = useQuery(orpc.expenses.list.queryOptions({ input: { eventId: id, page: 1, limit: 100 } }));
  const paymentsQuery = useQuery(orpc.payments.list.queryOptions({ input: { eventId: id, page: 1, limit: 100 } }));
  const invoicesQuery = useQuery(orpc.invoices.list.queryOptions({ input: { eventId: id, page: 1, limit: 100 } }));
  const availableEquipmentQuery = useQuery(orpc.equipment.list.queryOptions({ input: { status: "available", page: 1, limit: 100 } }));
  const staffListQuery = useQuery(orpc.staff.list.queryOptions({ input: { page: 1, limit: 100 } }));
  const vendorsQuery = useQuery(orpc.vendors.list.queryOptions({ input: { page: 1, limit: 100 } }));

  const updateStatus = useMutation(orpc.events.updateStatus.mutationOptions());
  const assignEquipment = useMutation(orpc.equipmentAssignments.assign.mutationOptions());
  const recordReturn = useMutation(orpc.equipmentAssignments.recordReturn.mutationOptions());
  const assignStaff = useMutation(orpc.staffAssignments.assign.mutationOptions());
  const removeStaff = useMutation(orpc.staffAssignments.remove.mutationOptions());
  const recordAttendance = useMutation(orpc.attendance.record.mutationOptions());
  const createExpense = useMutation(orpc.expenses.create.mutationOptions());
  const deleteExpense = useMutation(orpc.expenses.delete.mutationOptions());

  const eventData = eventQuery.data;
  const summaryData = summaryQuery.data;
  const equipmentAssignments = (equipmentAssignmentsQuery.data ?? []) as EquipmentAssignmentRow[];
  const staffAssignments = (staffAssignmentsQuery.data ?? []) as StaffAssignmentRow[];
  const attendanceRecords = (attendanceQuery.data ?? []) as AttendanceRow[];
  const expenses = (expensesQuery.data?.expenses ?? []) as ExpenseRow[];
  const payments = (paymentsQuery.data?.payments ?? []) as PaymentRow[];
  const invoices = (invoicesQuery.data?.invoices ?? []) as InvoiceRow[];
  const availableEquipment = ((availableEquipmentQuery.data?.items ?? []) as AvailableEquipment[]).filter((item) => item.status === "available");
  const availableStaff = (staffListQuery.data?.users ?? []) as AvailableStaff[];
  const vendors = vendorsQuery.data?.vendors ?? [];

  const totalRevenue = eventData?.totalRevenue ?? 0;
  const totalExpenses = summaryData?.totalExpenses ?? 0;
  const profit = summaryData?.profit ?? totalRevenue - totalExpenses;

  const selectedEquipmentIds = Object.entries(selectedEquipment).filter(([, checked]) => checked).map(([equipmentId]) => equipmentId);
  const selectedStaffIds = Object.entries(selectedStaff).filter(([, checked]) => checked).map(([staffId]) => staffId);

  const handleStatusUpdate = async (newStatus: EventStatus) => {
    await updateStatus.mutateAsync(
      { id, status: newStatus },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.events.getById.queryOptions({ input: { id } }).queryKey });
          await queryClient.invalidateQueries({ queryKey: orpc.events.getEventSummary.queryOptions({ input: { id } }).queryKey });
          await queryClient.invalidateQueries({ queryKey: ["events", "list"] });
          toast.success("Event status updated");
        },
        onError: (error) => toast.error(error.message || "Failed to update status"),
      },
    );
  };

  const handleAssignEquipment = async () => {
    if (selectedEquipmentIds.length === 0) {
      toast.error("Select at least one equipment item");
      return;
    }

    try {
      await Promise.all(selectedEquipmentIds.map((equipmentId) => assignEquipment.mutateAsync({ eventId: id, equipmentId })));
      setSelectedEquipment({});
      await queryClient.invalidateQueries({ queryKey: orpc.equipmentAssignments.getByEvent.queryOptions({ input: { eventId: id } }).queryKey });
      await queryClient.invalidateQueries({ queryKey: orpc.equipment.list.queryOptions({ input: { status: "available", page: 1, limit: 100 } }).queryKey });
      toast.success("Equipment assigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign equipment");
    }
  };

  const handleReturnEquipment = async (assignmentId: string) => {
    const draft = returnDrafts[assignmentId] ?? { returnStatus: "returned" as const, damageNotes: "" };

    await recordReturn.mutateAsync(
      {
        assignmentId,
        returnStatus: draft.returnStatus,
        damageNotes: draft.damageNotes || undefined,
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.equipmentAssignments.getByEvent.queryOptions({ input: { eventId: id } }).queryKey });
          await queryClient.invalidateQueries({ queryKey: orpc.equipment.list.queryOptions({ input: { page: 1, limit: 100 } }).queryKey });
          toast.success("Return recorded");
        },
        onError: (error) => toast.error(error.message || "Failed to record return"),
      },
    );
  };

  const handleAssignStaff = async () => {
    if (selectedStaffIds.length === 0) {
      toast.error("Select at least one staff member");
      return;
    }

    try {
      await Promise.all(selectedStaffIds.map((userId) => assignStaff.mutateAsync({ eventId: id, userId })));
      setSelectedStaff({});
      await queryClient.invalidateQueries({ queryKey: orpc.staffAssignments.getByEvent.queryOptions({ input: { eventId: id } }).queryKey });
      toast.success("Staff assigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign staff");
    }
  };

  const handleRemoveStaff = async (assignmentId: string) => {
    await removeStaff.mutateAsync(
      { id: assignmentId },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.staffAssignments.getByEvent.queryOptions({ input: { eventId: id } }).queryKey });
          toast.success("Staff assignment removed");
        },
        onError: (error) => toast.error(error.message || "Failed to remove assignment"),
      },
    );
  };

  const handleAttendanceSubmit = async () => {
    if (!attendanceForm.userId) {
      toast.error("Select a staff member");
      return;
    }

    await recordAttendance.mutateAsync(
      {
        eventId: id,
        userId: attendanceForm.userId,
        date: new Date(attendanceForm.date),
        present: attendanceForm.present,
        hoursWorked: attendanceForm.hoursWorked ? Number(attendanceForm.hoursWorked) : undefined,
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.attendance.getByEvent.queryOptions({ input: { eventId: id } }).queryKey });
          setAttendanceForm({ userId: "", date: new Date().toISOString().slice(0, 10), present: true, hoursWorked: "" });
          toast.success("Attendance saved");
        },
        onError: (error) => toast.error(error.message || "Failed to save attendance"),
      },
    );
  };

  const handleCreateExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid expense amount");
      return;
    }

    await createExpense.mutateAsync(
      {
        eventId: id,
        category: expenseForm.category as (typeof expenseCategories)[number],
        amount,
        description: expenseForm.description || undefined,
        vendorId: expenseForm.vendorId || undefined,
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.expenses.list.queryOptions({ input: { eventId: id, page: 1, limit: 100 } }).queryKey });
          await queryClient.invalidateQueries({ queryKey: orpc.events.getEventSummary.queryOptions({ input: { id } }).queryKey });
          setExpenseForm({ category: "miscellaneous", amount: "", description: "", vendorId: "" });
          toast.success("Expense recorded");
        },
        onError: (error) => toast.error(error.message || "Failed to create expense"),
      },
    );
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await deleteExpense.mutateAsync(
      { id: expenseId },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: orpc.expenses.list.queryOptions({ input: { eventId: id, page: 1, limit: 100 } }).queryKey });
          await queryClient.invalidateQueries({ queryKey: orpc.events.getEventSummary.queryOptions({ input: { id } }).queryKey });
          toast.success("Expense deleted");
        },
        onError: (error) => toast.error(error.message || "Failed to delete expense"),
      },
    );
  };

  if (eventQuery.isLoading) {
    return <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">Loading event...</div>;
  }

  if (!eventData) {
    return <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">Event not found.</div>;
  }

  const currentStatus = eventData.status as EventStatus;
  const transitions = statusTransitions[currentStatus] ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title={eventData.name} description={`${eventData.location} · ${formatShortDate(eventData.startDate)} to ${formatShortDate(eventData.endDate)}`}>
        <StatusBadge status={eventData.status} />
        {transitions.map((transition) => (
          <Button key={transition.next} variant={transition.next === "cancelled" ? "destructive" : "default"} size="sm" onClick={() => handleStatusUpdate(transition.next)} disabled={updateStatus.isPending}>
            {transition.label}
          </Button>
        ))}
        <Button variant="outline" size="sm" render={<Link href={`/events/${id}/edit`} />}>
          <Pencil className="mr-2 size-4" />
          Edit
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Revenue" value={formatCurrency(totalRevenue)} icon={IndianRupee} description="Total event revenue" />
        <StatsCard title="Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} description="Total event expenses" />
        <StatsCard title={profit >= 0 ? "Profit" : "Loss"} value={formatCurrency(Math.abs(profit))} icon={TrendingUp} description={profit >= 0 ? "Net profit" : "Net loss"} />
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Event Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoItem icon={Calendar} label="Start Date" value={formatDate(eventData.startDate)} />
                  <InfoItem icon={Calendar} label="End Date" value={formatDate(eventData.endDate)} />
                  <InfoItem icon={Users} label="Client" value={eventData.clientName} />
                  <InfoItem icon={Receipt} label="Created By" value={eventData.creator?.name ?? "Unknown"} />
                </div>
                {eventData.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{eventData.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Financial Snapshot</CardTitle>
                <CardDescription>Quick view of the event balance and invoice state.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Invoices" value={String(invoices.length)} />
                  <MiniStat label="Payments" value={String(payments.length)} />
                  <MiniStat label="Equipment" value={String(equipmentAssignments.length)} />
                  <MiniStat label="Staff" value={String(staffAssignments.length)} />
                </div>
                <p className="text-sm text-muted-foreground">Use the tabs below to manage assignments, record costs, and review settlement status.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Package className="size-5 text-primary" /> Equipment Assignments</CardTitle>
                <CardDescription>Pick available items to assign to this event, then track returns with damage notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Available equipment</p>
                      <p className="text-xs text-muted-foreground">Select multiple items for bulk assignment.</p>
                    </div>
                    <Button size="sm" onClick={handleAssignEquipment} disabled={selectedEquipmentIds.length === 0}>
                      <Plus className="mr-2 size-4" />
                      Assign selected
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {availableEquipment.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No available equipment right now.</p>
                    ) : (
                      availableEquipment.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30">
                          <Checkbox checked={selectedEquipment[item.id] ?? false} onCheckedChange={(checked) => setSelectedEquipment((current) => ({ ...current, [item.id]: checked === true }))} />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{item.name}</p>
                              <StatusBadge status={item.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">{item.category?.name}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Assigned</th>
                        <th className="px-4 py-3">Return</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentAssignments.length === 0 ? (
                        <tr><td className="px-4 py-6 text-muted-foreground" colSpan={4}>No equipment assigned yet.</td></tr>
                      ) : (
                        equipmentAssignments.map((assignment) => {
                          const draft = returnDrafts[assignment.id] ?? { returnStatus: "returned" as const, damageNotes: "" };
                          return (
                            <tr key={assignment.id} className="border-t">
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <p className="font-medium">{assignment.equipment?.name}</p>
                                  <p className="text-xs text-muted-foreground">{assignment.equipment?.category?.name}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs text-muted-foreground">{formatShortDate(assignment.assignedAt)}</td>
                              <td className="px-4 py-4">
                                {assignment.returnedAt ? (
                                  <StatusBadge status={assignment.returnStatus ?? "returned"} />
                                ) : (
                                  <div className="space-y-2">
                                    <Select value={draft.returnStatus} onValueChange={(value) => setReturnDrafts((current) => ({ ...current, [assignment.id]: { ...draft, returnStatus: value as typeof returnStatuses[number] } }))}>
                                      <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {returnStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    <Textarea value={draft.damageNotes} onChange={(event) => setReturnDrafts((current) => ({ ...current, [assignment.id]: { ...draft, damageNotes: event.target.value } }))} placeholder="Damage notes" rows={2} />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {!assignment.returnedAt && (
                                  <Button size="sm" variant="outline" onClick={() => handleReturnEquipment(assignment.id)} disabled={recordReturn.isPending}>
                                    <Check className="mr-2 size-4" />
                                    Record return
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
                <CardDescription>Equipment currently in the event workflow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MiniStat label="Available" value={String(availableEquipment.length)} />
                <MiniStat label="Assigned" value={String(equipmentAssignments.filter((assignment) => !assignment.returnedAt).length)} />
                <MiniStat label="Returned" value={String(equipmentAssignments.filter((assignment) => assignment.returnedAt).length)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Users className="size-5 text-primary" /> Staff Assignments</CardTitle>
                <CardDescription>Bulk assign staff members to the event schedule.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Available staff</p>
                      <p className="text-xs text-muted-foreground">Select multiple staff members and assign them together.</p>
                    </div>
                    <Button size="sm" onClick={handleAssignStaff} disabled={selectedStaffIds.length === 0}>
                      <Plus className="mr-2 size-4" />
                      Assign selected
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {availableStaff.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No staff found.</p>
                    ) : (
                      availableStaff.map((member) => (
                        <label key={member.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30">
                          <Checkbox checked={selectedStaff[member.id] ?? false} onCheckedChange={(checked) => setSelectedStaff((current) => ({ ...current, [member.id]: checked === true }))} />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{member.name}</p>
                              {member.role && <Badge variant="outline">{member.role}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Staff</th>
                        <th className="px-4 py-3">Assigned</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffAssignments.length === 0 ? (
                        <tr><td className="px-4 py-6 text-muted-foreground" colSpan={3}>No staff assigned yet.</td></tr>
                      ) : (
                        staffAssignments.map((assignment) => (
                          <tr key={assignment.id} className="border-t">
                            <td className="px-4 py-4">
                              <p className="font-medium">{assignment.user?.name}</p>
                              <p className="text-xs text-muted-foreground">{assignment.user?.email}</p>
                            </td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">{formatShortDate(assignment.assignedAt)}</td>
                            <td className="px-4 py-4">
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveStaff(assignment.id)} disabled={removeStaff.isPending}>
                                <Trash2 className="mr-2 size-4" />
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Staff Load</CardTitle>
                <CardDescription>Quick count of who is already on the event.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MiniStat label="Assigned staff" value={String(staffAssignments.length)} />
                <MiniStat label="Available staff" value={String(availableStaff.length)} />
                <MiniStat label="Event headcount" value={String(staffAssignments.length + availableStaff.length)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Record Attendance</CardTitle>
                <CardDescription>Track presence and hours worked by day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Staff member</Label>
                  <Select value={attendanceForm.userId} onValueChange={(value) => setAttendanceForm((current) => ({ ...current, userId: value ?? "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {availableStaff.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={attendanceForm.date} onChange={(event) => setAttendanceForm((current) => ({ ...current, date: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hours worked</Label>
                    <Input type="number" min="0" value={attendanceForm.hoursWorked} onChange={(event) => setAttendanceForm((current) => ({ ...current, hoursWorked: event.target.value }))} placeholder="Optional" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={attendanceForm.present} onCheckedChange={(checked) => setAttendanceForm((current) => ({ ...current, present: checked === true }))} />
                  Present for the event day
                </label>
                <Button onClick={handleAttendanceSubmit} disabled={recordAttendance.isPending}>
                  <Check className="mr-2 size-4" />
                  Save attendance
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Tracking</CardTitle>
                <CardDescription>Every saved record remains tied to the event schedule.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {attendanceRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
                ) : (
                  attendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                      <div>
                        <p className="text-sm font-medium">{record.user.name}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDate(record.date)} · {record.present ? "Present" : "Absent"}</p>
                      </div>
                      <Badge variant="outline">{record.hoursWorked != null ? `${record.hoursWorked}h` : "-"}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Record Expense</CardTitle>
                <CardDescription>Capture event costs against a vendor or direct category.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm((current) => ({ ...current, category: value ?? "miscellaneous" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (paise)</Label>
                  <Input type="number" min="1" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional expense note" />
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Select value={expenseForm.vendorId} onValueChange={(value) => setExpenseForm((current) => ({ ...current, vendorId: value ?? "" }))}>
                    <SelectTrigger><SelectValue placeholder="Optional vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" className="px-0 text-xs" onClick={() => setExpenseForm((current) => ({ ...current, vendorId: "" }))}>
                    Clear vendor
                  </Button>
                </div>
                <Button onClick={handleCreateExpense} disabled={createExpense.isPending}>
                  <Plus className="mr-2 size-4" />
                  Save expense
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Ledger</CardTitle>
                <CardDescription>Itemized costs currently attributed to the event.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
                ) : (
                  expenses.map((expense) => (
                    <div key={expense.id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={expense.category} />
                            {expense.vendor && <Badge variant="outline">{expense.vendor.name}</Badge>}
                          </div>
                          <p className="text-sm font-medium">{expense.description || "Expense"}</p>
                          <p className="text-xs text-muted-foreground">{formatShortDate(expense.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(expense.amount)}</p>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteExpense(expense.id)}>
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Payments are recorded against invoices and reflected in the invoice detail page as well.</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-t">
                          <td className="px-4 py-4 text-xs text-muted-foreground">{formatShortDate(payment.paymentDate)}</td>
                          <td className="px-4 py-4">{payment.invoice ? <Link href={`/invoices/${payment.invoice.id}`} className="hover:underline">{payment.invoice.invoiceNumber}</Link> : "-"}</td>
                          <td className="px-4 py-4"><StatusBadge status={payment.type} /></td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">{payment.paymentMethod || "-"}</td>
                          <td className="px-4 py-4 text-right font-medium">{formatCurrency(payment.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Open or create invoices linked to this event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button render={<Link href="/invoices" />}>
                <Receipt className="mr-2 size-4" />
                Open invoices
              </Button>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr><td className="px-4 py-6 text-muted-foreground" colSpan={4}>No invoices created for this event yet.</td></tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t">
                          <td className="px-4 py-4"><Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">{invoice.invoiceNumber}</Link></td>
                          <td className="px-4 py-4"><StatusBadge status={invoice.status} /></td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">{formatShortDate(invoice.dueDate)}</td>
                          <td className="px-4 py-4 text-right font-medium">{formatCurrency(invoice.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-5 text-primary/70" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}