"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        onClick={google}
        className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50"
      >
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
      </div>
      {status === "sent" ? (
        <p className="text-sm">Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={magicLink} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            disabled={status === "sending"}
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Email me a link"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">Couldn&apos;t send the link. Try again.</p>}
        </form>
      )}
    </div>
  );
}
