"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ensureGuestSession } from "@/lib/guest";

/** Signs the visitor in anonymously, opens a whiteboard, and sends them straight into it. */
export function TryStarter() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        await ensureGuestSession();
        const res = await fetch("/api/guest/board", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't start");
        router.replace(`/board/${data.sessionId}`);
      } catch (err) {
        // Guest mode needs anonymous sign-ins enabled in Supabase; without it, send them to signup.
        const message = err instanceof Error ? err.message : "";
        setError(/anonymous/i.test(message) ? "guest_unavailable" : message || "Couldn't start");
      }
    })();
  }, [router]);

  return (
    <main className="graph-paper flex min-h-dvh items-center justify-center px-4 text-ink">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-lg font-semibold">{error === "guest_unavailable" ? "Let's get you a free account instead." : error}</p>
            <p className="mt-2 text-muted">It takes one email and a password, and your work is saved.</p>
            <Link href="/login?next=/board" className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 font-medium text-white">
              Create a free account →
            </Link>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold tracking-tight">Opening your board…</p>
            <p className="mt-2 text-muted">No account needed. Ask Lumo anything you&apos;re stuck on.</p>
          </>
        )}
      </div>
    </main>
  );
}
