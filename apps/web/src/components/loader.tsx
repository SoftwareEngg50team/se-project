import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="surface-glow relative flex h-full min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card/50">
      <div className="absolute size-24 rounded-full bg-primary/30 blur-2xl animate-float-y" />
      <div className="absolute size-16 rounded-full border border-primary/40 animate-pulse-ring" />
      <div className="relative flex items-center gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2 shadow-sm backdrop-blur">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground/90">Loading experience...</span>
      </div>
    </div>
  );
}
