"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md space-y-4 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Something went wrong
          </p>
          <h1 className="text-2xl font-bold tracking-tight">We could not load this page.</h1>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred while rendering the app."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}