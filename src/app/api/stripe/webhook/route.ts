import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

/** Keeps profiles.plan in sync with Stripe subscriptions. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error: seen } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe().subscriptions.retrieve(String(session.subscription));
          await applySubscription(sub, session.client_reference_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object, null);
        break;
    }
  } catch (err) {
    // Let Stripe retry: forget the event so the retry isn't treated as a duplicate.
    await db.from("stripe_events").delete().eq("id", event.id);
    console.error("webhook handling failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function applySubscription(sub: Stripe.Subscription, userIdHint: string | null) {
  const db = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const update = {
    stripe_customer_id: customerId,
    plan: ACTIVE.has(sub.status) ? "pro" : "free",
    plan_status: sub.status,
    plan_interval: item?.price.recurring?.interval === "year" ? "year" : "month",
    current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
  };

  const userId = userIdHint ?? sub.metadata?.user_id;
  const query = db.from("profiles").update(update);
  const { error } = userId ? await query.eq("id", userId) : await query.eq("stripe_customer_id", customerId);
  if (error) throw error;
}
