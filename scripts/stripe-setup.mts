/**
 * Creates the LumoTutor Plus and Pro products with monthly/yearly prices in whichever Stripe account
 * STRIPE_SECRET_KEY belongs to. Safe to run again: existing prices (found by lookup key) are reused.
 * Retires the original single "Pro" plan prices so they can't be sold anymore.
 *
 *   npm run stripe:setup
 */
import Stripe from "stripe";
import { PAID_PLANS, PLANS } from "../src/lib/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("Add STRIPE_SECRET_KEY to .env.local first");
const stripe = new Stripe(key);
console.log(`Stripe mode: ${key.includes("_live_") ? "LIVE" : "test"}`);

for (const planId of PAID_PLANS) {
  const plan = PLANS[planId];
  const keys = [plan.monthly!.lookupKey, plan.yearly!.lookupKey];
  const existing = await stripe.prices.list({ lookup_keys: keys, active: true, expand: ["data.product"] });
  let productId = existing.data[0] ? (existing.data[0].product as Stripe.Product).id : null;
  if (!productId) {
    const product = await stripe.products.create({ name: `LumoTutor ${plan.name}`, description: plan.tagline });
    productId = product.id;
    console.log(`Created product LumoTutor ${plan.name} (${productId})`);
  }
  for (const [interval, price] of [["month", plan.monthly!], ["year", plan.yearly!]] as const) {
    const found = existing.data.find((p) => p.lookup_key === price.lookupKey);
    if (found) {
      console.log(`  ${price.lookupKey} exists: $${(found.unit_amount ?? 0) / 100}/${interval}`);
      continue;
    }
    await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: Math.round(price.price * 100),
      recurring: { interval },
      lookup_key: price.lookupKey,
      transfer_lookup_key: true,
    });
    console.log(`  Created ${price.lookupKey}: $${price.price}/${interval}`);
  }
}

// Retire the launch-era single Pro plan.
const legacy = await stripe.prices.list({ lookup_keys: ["videotutor_pro_monthly", "videotutor_pro_yearly"], active: true });
for (const p of legacy.data) {
  await stripe.prices.update(p.id, { active: false });
  if (typeof p.product === "string") await stripe.products.update(p.product, { active: false }).catch(() => null);
  console.log(`Retired legacy price ${p.lookup_key}`);
}
