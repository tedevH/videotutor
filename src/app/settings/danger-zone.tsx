"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Deleting an account is permanent, so it asks for the word and says exactly what goes. */
export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't delete the account");
    router.push("/");
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-red-200 bg-red-50/60 p-5">
      <h2 className="text-lg font-semibold text-red-900">Delete account</h2>
      <p className="mt-1 text-sm text-red-900/80">
        Deletes your account, every lecture and assignment you added, your conversations, your uploads and everything Lumo has learned about you. This
        cannot be undone. Export your data first if you want a copy.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
          Delete my account
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-sm font-medium text-red-900" htmlFor="confirm-delete">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-red-300 px-3 py-2 text-sm outline-none focus:border-red-500"
            placeholder="DELETE"
          />
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={confirm !== "DELETE" || busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
