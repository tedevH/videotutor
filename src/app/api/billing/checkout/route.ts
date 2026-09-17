import { NextResponse } from "next/server";
import { lookupKeyFor, type BillingInterval } from "@/lib/plans";
import { priceForLookupKey, stripe } from "@/lib/stripe";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Starts a Stripe Checkout session for Pro and returns its URL. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { interval } = (await request.json()) as { interval?: BillingInterval };
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("plan, stripe_customer_id").eq("id", user.id).single();
  if (profile?.plan === "pro") return NextResponse.json({ error: "You're already on Pro" }, { status: 400 });

  try {
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } });
      customerId = customer.id;
      await db.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const price = await priceForLookupKey(lookupKeyFor(interval === "year" ? "year" : "month"));
    const origin = new URL(request.url).origin;
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${origin}/library?upgraded=1`,
      cancel_url: `${origin}/pricing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
