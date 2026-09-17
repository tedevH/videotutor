import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-only Stripe client. Throws a clear error when the secret key isn't configured. */
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const billingEnabled = () => !!process.env.STRIPE_SECRET_KEY;

/** Resolves a price by its lookup key, so price IDs never need to be copied into env vars. */
export async function priceForLookupKey(lookupKey: string) {
  const { data } = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (!data[0]) throw new Error(`No active Stripe price with lookup key "${lookupKey}". Run: npm run stripe:setup`);
  return data[0];
}
