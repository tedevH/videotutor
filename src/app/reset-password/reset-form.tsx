"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6 space-y-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 8) return setError("Use at least 8 characters.");
        setBusy(true);
        const { error } = await createClient().auth.updateUser({ password });
        setBusy(false);
        if (error) return setError(error.message);
        router.push("/home");
        router.refresh();
      }}
    >
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (8+ characters)"
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
