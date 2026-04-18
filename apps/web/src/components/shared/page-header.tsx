interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

import { motion } from "framer-motion";

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <motion.div
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <motion.div
          className="flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
