import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Opens the Stripe customer portal (change plan, update card, cancel). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: profile } = await createAdminClient().from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet" }, { status: 400 });

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${new URL(request.url).origin}/library`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("portal failed", err);
    return NextResponse.json({ error: "Couldn't open billing. Please try again." }, { status: 500 });
  }
}
