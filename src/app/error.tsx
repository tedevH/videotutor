"use client";

import Link from "next/link";

/** A page-level failure: say what happened, keep them moving. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="graph-paper flex min-h-dvh items-center justify-center px-4 text-ink">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">That page hit a snag.</h1>
        <p className="mt-3 text-ink/70">
          Your work is saved. Try again, or head home and come back to it.
          {error.digest && <span className="mt-2 block text-xs text-muted">Reference: {error.digest}</span>}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
            Try again
          </button>
          <Link href="/home" className="rounded-lg border border-ink/20 bg-white px-4 py-2 text-sm font-medium">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
