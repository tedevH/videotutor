"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, type BillingInterval, type PaidPlanId, type PlanId } from "@/lib/plans";
import { UpgradeButton } from "./billing-buttons";

const fmt = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/** Free / Plus / Pro with Plus as the obvious default. */
export function PricingCards({ signedIn, currentPlan }: { signedIn: boolean; currentPlan: PlanId | null }) {
  const [interval, setBillingInterval] = useState<BillingInterval>("month");

  const paid = (id: PaidPlanId) => {
    const p = PLANS[id];
    const monthlyEquivalent = interval === "year" ? p.yearly!.price / 12 : p.monthly!.price;
    const note = interval === "year" ? `${fmt(p.yearly!.price)} billed yearly` : "billed monthly · cancel anytime";
    return { p, monthlyEquivalent, note };
  };

  return (
    <div>
      <div className="mx-auto flex w-fit rounded-full border border-ink/15 bg-white p-1 text-sm">
        {(["month", "year"] as const).map((i) => (
          <button
            key={i}
            onClick={() => setBillingInterval(i)}
            className={`rounded-full px-4 py-1.5 font-medium transition ${interval === i ? "bg-ink text-white" : "text-ink/70 hover:text-ink"}`}
          >
            {i === "month" ? "Monthly" : "Yearly"}
            {i === "year" && <span className={`ml-1.5 ${interval === i ? "text-marker" : "text-pen"}`}>save 33%</span>}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl items-center gap-5 lg:grid-cols-[1fr_1.15fr_1fr]">
        {/* Free */}
        <article className="flex h-full flex-col rounded-3xl border border-ink/15 bg-white p-6">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="text-sm text-muted">{PLANS.free.tagline}</p>
          <p className="mt-4 text-4xl font-semibold tracking-tight">$0</p>
          <p className="text-sm text-muted">forever</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">
            {PLANS.free.features.map((f) => (
              <li key={f} className="flex gap-2 text-ink/80">
                <span className="text-ink/35">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link href={signedIn ? "/home" : "/login?next=/home"} className="mt-6 rounded-xl border border-ink/20 py-2.5 text-center text-sm font-medium hover:bg-stone-50">
            {currentPlan === "free" ? "Your current plan" : "Start free"}
          </Link>
        </article>

        {/* Plus: the default choice */}
        {(() => {
          const { p, monthlyEquivalent, note } = paid("plus");
          return (
            <article className="relative flex flex-col rounded-3xl border-2 border-ink bg-[#fff1b8] p-7 shadow-[7px_7px_0_#1c1b19] lg:py-9">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pen px-4 py-1 text-xs font-semibold text-white">Most students choose Plus</span>
              <h3 className="text-2xl font-semibold">LumoTutor Plus</h3>
              <p className="mt-1 text-ink/75">{p.tagline}</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight">
                {fmt(Math.round(monthlyEquivalent * 100) / 100)}
                <span className="text-lg font-medium text-ink/60">/month</span>
              </p>
              <p className="text-sm text-ink/60">{note}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span className="text-pen">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                {currentPlan === "plus" ? (
                  <Link href="/home" className="block rounded-xl bg-ink py-3 text-center font-medium text-white">
                    You&apos;re on Plus
                  </Link>
                ) : currentPlan === "pro" ? null : (
                  <UpgradeButton plan="plus" interval={interval} signedIn={signedIn} className="w-full rounded-xl bg-ink py-3.5 font-semibold text-white hover:bg-ink/85 disabled:opacity-60">
                    Get Plus
                  </UpgradeButton>
                )}
              </div>
            </article>
          );
        })()}

        {/* Pro */}
        {(() => {
          const { p, monthlyEquivalent, note } = paid("pro");
          return (
            <article className="flex h-full flex-col rounded-3xl border border-ink/15 bg-white p-6">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="text-sm text-muted">{p.tagline}</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight">
                {fmt(Math.round(monthlyEquivalent * 100) / 100)}
                <span className="text-base font-medium text-ink/60">/month</span>
              </p>
              <p className="text-sm text-muted">{note}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-ink/80">
                    <span className="text-ink/35">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {currentPlan === "pro" ? (
                  <Link href="/home" className="block rounded-xl border border-ink/20 py-2.5 text-center text-sm font-medium">
                    You&apos;re on Pro
                  </Link>
                ) : currentPlan === "plus" ? (
                  <p className="text-center text-sm text-muted">Switch anytime from Manage billing</p>
                ) : (
                  <UpgradeButton plan="pro" interval={interval} signedIn={signedIn} className="w-full rounded-xl border border-ink/25 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-60">
                    Get Pro
                  </UpgradeButton>
                )}
              </div>
            </article>
          );
        })()}
      </div>
    </div>
  );
}
