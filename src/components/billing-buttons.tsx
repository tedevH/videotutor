"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingInterval, PaidPlanId } from "@/lib/plans";

async function redirectTo(endpoint: string, body: object, onError: (msg: string) => void) {
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return false;
  if (!res.ok || !data.url) {
    onError(data.error ?? "Something went wrong");
    return true;
  }
  window.location.href = data.url;
  return true;
}

export function UpgradeButton({
  plan,
  interval,
  signedIn,
  className,
  children,
}: {
  plan: PaidPlanId;
  interval: BillingInterval;
  signedIn: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={loading}
        onClick={async () => {
          if (!signedIn) return router.push("/login?next=/pricing");
          setLoading(true);
          setError(null);
          const handled = await redirectTo("/api/billing/checkout", { plan, interval }, setError);
          if (!handled) router.push("/login?next=/pricing");
          setLoading(false);
        }}
        className={className}
      >
        {loading ? "Opening checkout…" : children}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function ManageBillingButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          await redirectTo("/api/billing/portal", {}, setError);
          setLoading(false);
        }}
        className={className}
      >
        {loading ? "Opening…" : "Manage billing"}
      </button>
      {error && <span className="ml-2 text-sm text-red-600">{error}</span>}
    </span>
  );
}
