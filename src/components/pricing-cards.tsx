"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS, type BillingInterval } from "@/lib/plans";
import { UpgradeButton } from "./billing-buttons";

export function PricingCards({ signedIn, currentPlan }: { signedIn: boolean; currentPlan: string | null }) {
  const [interval, setBillingInterval] = useState<BillingInterval>("year");
  const pro = PLANS.pro;
  const monthlyEquivalent = interval === "year" ? pro.yearly.price / 12 : pro.monthly.price;

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

      <div className="mx-auto mt-8 grid max-w-4xl gap-5 md:grid-cols-2">
        <article className="flex flex-col rounded-3xl border-2 border-ink/15 bg-white p-7">
          <h3 className="text-lg font-semibold">{PLANS.free.name}</h3>
          <p className="mt-3 text-5xl font-semibold tracking-tight">$0</p>
          <p className="mt-1 text-sm text-muted">forever</p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {PLANS.free.features.map((f) => (
              <li key={f} className="flex gap-2.5 text-ink/80">
                <span className="text-ink/40">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href={signedIn ? "/library" : "/login?next=/library"}
            className="mt-8 rounded-xl border border-ink/20 py-3 text-center font-medium hover:bg-stone-50"
          >
            {currentPlan === "free" ? "Your current plan" : "Start free"}
          </Link>
        </article>

        <article className="relative flex flex-col rounded-3xl border-2 border-ink bg-[#fff1b8] p-7 shadow-[6px_6px_0_#1c1b19]">
          <span className="absolute -top-3 right-6 rounded-full bg-pen px-3 py-1 text-xs font-semibold text-white">For hard courses</span>
          <h3 className="text-lg font-semibold">{pro.name}</h3>
          <p className="mt-3 text-5xl font-semibold tracking-tight">
            ${Number.isInteger(monthlyEquivalent) ? monthlyEquivalent : monthlyEquivalent.toFixed(2)}
            <span className="text-lg font-medium text-ink/60">/month</span>
          </p>
          <p className="mt-1 text-sm text-ink/60">
            {interval === "year" ? `$${pro.yearly.price} billed yearly` : "billed monthly, cancel anytime"}
          </p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {pro.features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="text-pen">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {currentPlan === "pro" ? (
              <Link href="/library" className="block rounded-xl bg-ink py-3 text-center font-medium text-white">
                You&apos;re on Pro
              </Link>
            ) : (
              <UpgradeButton interval={interval} signedIn={signedIn} className="w-full rounded-xl bg-ink py-3 font-medium text-white hover:bg-ink/85 disabled:opacity-60">
                Get Pro
              </UpgradeButton>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
