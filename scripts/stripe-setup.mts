/**
 * Creates the Pro product and its monthly/yearly prices in whichever Stripe account
 * STRIPE_SECRET_KEY belongs to (test or live). Safe to run again: existing prices are reused.
 *
 *   npm run stripe:setup
 */
import Stripe from "stripe";
import { PLANS } from "../src/lib/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("Add STRIPE_SECRET_KEY to .env.local first");
const stripe = new Stripe(key);
console.log(`Stripe mode: ${key.startsWith("sk_live") ? "LIVE" : "test"}`);

const existing = await stripe.prices.list({ lookup_keys: [PLANS.pro.monthly.lookupKey, PLANS.pro.yearly.lookupKey], active: true, expand: ["data.product"] });
let productId = existing.data[0] ? (existing.data[0].product as Stripe.Product).id : null;
if (!productId) {
  const product = await stripe.products.create({ name: "VideoTutor Pro", description: PLANS.pro.features.join(" · ") });
  productId = product.id;
  console.log(`Created product ${productId}`);
}

for (const [interval, plan] of [["month", PLANS.pro.monthly], ["year", PLANS.pro.yearly]] as const) {
  const found = existing.data.find((p) => p.lookup_key === plan.lookupKey);
  if (found) {
    console.log(`Price ${plan.lookupKey} exists: ${found.id} ($${(found.unit_amount ?? 0) / 100}/${interval})`);
    continue;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: plan.price * 100,
    recurring: { interval },
    lookup_key: plan.lookupKey,
  });
  console.log(`Created price ${plan.lookupKey}: ${price.id} ($${plan.price}/${interval})`);
}
