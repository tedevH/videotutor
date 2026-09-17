import Link from "next/link";
import { InviteFriends } from "@/components/invite-friends";
import { PricingCards } from "@/components/pricing-cards";
import { effectivePlan } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("plan, plus_trial_until").eq("id", user.id).maybeSingle() : { data: null };
  const current = user ? effectivePlan(profile) : null;

  return (
    <main className="graph-paper flex flex-1 flex-col text-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href={user ? "/home" : "/"} className="text-xl font-semibold tracking-tight">
          LumoTutor
        </Link>
        {!user && (
          <Link href="/login?next=/pricing" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85">
            Sign in
          </Link>
        )}
      </header>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <p className="text-center text-sm font-semibold text-pen">LumoTutor Plus · $9.99/month</p>
        <h1 className="mt-2 text-center text-[36px] font-semibold leading-tight tracking-tight sm:text-[52px]">Your personal AI teacher for every class.</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-lg text-ink/75">Start free. Upgrade when you want Lumo in every lecture, every problem set, and every exam.</p>
        <div className="mt-10">
          <PricingCards signedIn={!!user} currentPlan={current} />
        </div>
        {user && current === "free" && (
          <div className="mx-auto mt-10 max-w-2xl">
            <InviteFriends />
          </div>
        )}
        {!user && (
          <p className="mx-auto mt-10 max-w-xl text-center text-ink/75">
            <span className="font-semibold">Invite 2 friends, unlock 14 days of Plus.</span> Sign up free and share your link.
          </p>
        )}
        <p className="mt-8 text-center text-sm text-muted">Prices in USD. Cancel anytime; you keep your plan until the end of the billing period.</p>
      </section>
    </main>
  );
}
