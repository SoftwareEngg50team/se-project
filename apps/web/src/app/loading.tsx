export default function Loading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6 md:p-8 animate-fade-slide-up">
      <div className="h-8 w-40 rounded-lg bg-linear-to-r from-muted via-muted/40 to-muted animate-shimmer-x" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="h-4 w-28 rounded bg-linear-to-r from-muted via-muted/40 to-muted animate-shimmer-x" />
            <div className="mt-4 h-8 w-20 rounded bg-linear-to-r from-muted via-muted/40 to-muted animate-shimmer-x" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="h-5 w-36 rounded bg-linear-to-r from-muted via-muted/40 to-muted animate-shimmer-x" />
        </div>
        <div className="h-80 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="h-5 w-36 rounded bg-linear-to-r from-muted via-muted/40 to-muted animate-shimmer-x" />
        </div>
      </div>
    </div>
  );
}