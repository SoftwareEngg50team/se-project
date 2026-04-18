import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
}: StatsCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <Card className="relative overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 size-24 rounded-full bg-primary/10" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <motion.div
            className="flex size-9 items-center justify-center rounded-lg bg-primary/10"
            whileHover={{ rotate: 6 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <Icon className="size-4 text-primary" />
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
