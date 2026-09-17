import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { ManageBillingButton } from "@/components/billing-buttons";
import { PlanUsage } from "@/components/plan-usage";
import { effectivePlan } from "@/lib/entitlements";
import { SITE } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { usageSummary } from "@/lib/usage";
import { DangerZone } from "./danger-zone";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase.from("profiles").select("plan, plus_trial_until, stripe_customer_id").eq("id", user.id).maybeSingle();
  const plan = effectivePlan(profile);
  const meters = await usageSummary(user.id, plan);

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <AppNav current="/home" />

        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">{user.email}</p>

        <div className="mt-6 space-y-5">
          <PlanUsage plan={plan} meters={meters} trialUntil={plan === "plus" && profile?.plan !== "plus" ? profile?.plus_trial_until : null} />

          <section className="rounded-3xl border border-ink/10 bg-white p-5">
            <h2 className="text-lg font-semibold">Billing</h2>
            <p className="mt-1 text-sm text-muted">
              {profile?.stripe_customer_id
                ? "Change plan, update your card or cancel. Cancelling keeps access until the period you've paid for ends."
                : "You're on the Free plan."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile?.stripe_customer_id ? (
                <ManageBillingButton className="rounded-lg border border-ink/20 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50" />
              ) : (
                <Link href="/pricing" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
                  See plans →
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-ink/10 bg-white p-5">
            <h2 className="text-lg font-semibold">Your data</h2>
            <p className="mt-1 text-sm text-muted">
              Download everything we hold about you: your account, conversations, uploads, courses and what Lumo has learned about you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="/api/account/export" className="rounded-lg border border-ink/20 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50" download>
                Export my data (JSON)
              </a>
              <Link href="/privacy" className="rounded-lg px-4 py-2 text-sm text-muted hover:text-ink">
                Privacy Policy
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-ink/10 bg-white p-5">
            <h2 className="text-lg font-semibold">Help</h2>
            <p className="mt-1 text-sm text-muted">
              Something broken, or an answer that was wrong? Email <a href={`mailto:${SITE.supportEmail}`} className="font-medium text-pen">{SITE.supportEmail}</a> and
              include the lecture or assignment: it goes straight to a human.
            </p>
          </section>

          <DangerZone />
        </div>
      </div>
    </main>
  );
}
