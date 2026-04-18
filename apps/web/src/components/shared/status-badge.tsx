import { Badge } from "@se-project/ui/components/badge";
import { cn } from "@se-project/ui/lib/utils";

const statusStyles: Record<string, string> = {
  // Event statuses
  upcoming: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",

  // Equipment statuses
  available: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  assigned: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  in_transit: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
  at_event: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  under_repair: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",

  // Return statuses
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  returned: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  missing: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  damaged: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",

  // Invoice statuses
  draft: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  overdue: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",

  // Vendor types
  food: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  transportation: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  repair: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  other: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",

  // Expense categories
  salary: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  equipment_repair: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  miscellaneous: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",

  // Payment types
  customer_advance: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  customer_payment: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  vendor_payment: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",

  // Roles
  owner: "bg-primary/10 text-primary border-primary/20",
  eventHead: "bg-secondary/10 text-secondary border-secondary/20",
  event_head: "bg-secondary/10 text-secondary border-secondary/20",
  staff: "bg-accent/20 text-accent-foreground border-accent/30",
};

function formatLabel(status: string): string {
  if (!status) return "N/A";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-xs",
        statusStyles[status] ?? "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
        className,
      )}
    >
      {formatLabel(status)}
    </Badge>
  );
}
