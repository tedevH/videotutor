"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddVideoForm({ signedIn = true }: { signedIn?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      router.push("/login?next=/library");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    router.push(`/watch/${data.sessionId}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a lecture link (YouTube, Vimeo…)"
          required
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-accent"
        />
        <button
          disabled={loading}
          className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Opening…" : "Start learning"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
