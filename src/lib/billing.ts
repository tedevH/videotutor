import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

/** Writes a subscription's state onto the student's profile. */
export async function applySubscription(sub: Stripe.Subscription, userIdHint: string | null) {
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

/**
 * Pulls the customer's current subscription straight from Stripe. Used when returning from checkout,
 * so upgrades apply even if the webhook is delayed or not configured (e.g. local development).
 */
export async function syncSubscriptionFromStripe(userId: string, customerId: string) {
  const { data } = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 5 });
  const current = data.find((s) => ACTIVE.has(s.status)) ?? data[0];
  if (current) await applySubscription(current, userId);
  return current?.status ?? null;
}
