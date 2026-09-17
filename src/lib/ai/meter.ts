import { createAdminClient } from "@/lib/supabase/server";

/** USD per 1M tokens, from ai.google.dev/gemini-api/docs/pricing. Update when prices move. */
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 2.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
};
const DEFAULT_PRICE = { input: 0.3, output: 2.5 };

/** Token counts from a Gemini response; thinking tokens bill as output. */
export function usageFrom(meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined) {
  return { inputTokens: meta?.promptTokenCount ?? 0, outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0) };
}

export type MeteredKind = "tutor" | "ingest" | "course" | "homework" | "practice";

export function costOf(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICES[model] ?? DEFAULT_PRICE;
  return (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
}

/**
 * Records what an AI call cost. Every Gemini call goes through here, not just tutor answers,
 * so spend is knowable: indexing a lecture costs more than the question that follows it.
 */
export async function recordUsage(
  userId: string | null,
  kind: MeteredKind,
  model: string,
  usage: { inputTokens: number; outputTokens: number },
) {
  const { error } = await createAdminClient().from("usage_events").insert({
    user_id: userId,
    kind,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
  });
  if (error) console.error("usage not recorded", kind, error.message);
}

const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

/** What this student has cost us this month, in USD, across every kind of AI call. */
export async function monthlySpend(userId: string) {
  const { data } = await createAdminClient()
    .from("usage_events")
    .select("model, input_tokens, output_tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth());
  return (data ?? []).reduce((total, e) => total + costOf(e.model ?? "", e.input_tokens ?? 0, e.output_tokens ?? 0), 0);
}
