import Link from "next/link";
import type { PlanId } from "@/lib/plans";
import type { UsageMeter } from "@/lib/usage";

const BAR = (pct: number) => (pct >= 1 ? "bg-red-500" : pct >= 0.8 ? "bg-amber-500" : "bg-pen");

/** Shows exactly what's left on the current plan, so limits are never a surprise mid-question. */
export function PlanUsage({ plan, meters, trialUntil }: { plan: PlanId; meters: UsageMeter[]; trialUntil?: string | null }) {
  const planName = plan === "pro" ? "Pro" : plan === "plus" ? "Plus" : "Free";
  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm">
          Plan: <span className="font-semibold">{planName}</span>
          {trialUntil && <span className="text-muted"> · free until {new Date(trialUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
        </p>
        {plan !== "pro" && (
          <Link href="/pricing" className="text-sm font-medium text-pen">
            {plan === "free" ? "Upgrade →" : "See Pro →"}
          </Link>
        )}
      </div>

      <ul className="mt-3 space-y-2.5">
        {meters.map((m) => {
          const pct = Math.min(m.used / m.limit, 1);
          const left = Math.max(m.limit - m.used, 0);
          return (
            <li key={m.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-ink/80">{m.label}</span>
                <span className={pct >= 1 ? "font-semibold text-red-600" : "text-muted"}>
                  {m.used} / {m.limit} {m.unit}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div className={`h-full rounded-full ${BAR(pct)}`} style={{ width: `${Math.max(pct * 100, m.used > 0 ? 4 : 0)}%` }} />
              </div>
              {pct >= 0.8 && (
                <p className="mt-1 text-xs text-muted">
                  {left === 0 ? `None left — ${m.resets}.` : `${left} left, ${m.resets}.`}
                  {plan !== "pro" && left === 0 && (
                    <>
                      {" "}
                      <Link href="/pricing" className="font-medium text-pen">
                        Get more →
                      </Link>
                    </>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
