import Link from "next/link";
import { PricingCards } from "@/components/pricing-cards";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pricing · LumoTutor" };

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle() : { data: null };

  return (
    <main className="graph-paper flex flex-1 flex-col text-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href={user ? "/library" : "/"} className="text-xl font-semibold tracking-tight">
          LumoTutor
        </Link>
        {!user && (
          <Link href="/login?next=/pricing" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85">
            Sign in
          </Link>
        )}
      </header>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <h1 className="text-center text-[36px] font-semibold leading-tight tracking-tight sm:text-[52px]">Simple pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-lg text-ink/75">
          Start free. Upgrade when a hard course needs more questions and step-by-step checked math.
        </p>
        <div className="mt-10">
          <PricingCards signedIn={!!user} currentPlan={profile?.plan ?? null} />
        </div>
        <p className="mt-8 text-center text-sm text-muted">Prices in USD. Cancel anytime from your account; you keep Pro until the end of the billing period.</p>
      </section>
    </main>
  );
}
