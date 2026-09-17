const RETRYABLE = [429, 500, 503, 504];

/** Models tried in order when the preferred one is overloaded. */
export const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.1-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);

/** Retries Gemini calls that fail from overload or rate limits, with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.min(20_000, 1500 * 2 ** i) + Math.random() * 800));
    }
  }
  throw lastError;
}

/**
 * Like withRetry, but if the model stays overloaded, falls back to the next model in the list.
 * `fn` receives the model name to use.
 */
export async function withModelFallback<T>(primary: string, fn: (model: string) => Promise<T>): Promise<T> {
  const models = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  let lastError: unknown;
  for (const [i, model] of models.entries()) {
    try {
      return await withRetry(() => fn(model), i === models.length - 1 ? 5 : 3);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
      console.warn(`${model} unavailable, trying ${models[i + 1] ?? "nothing else"}`);
    }
  }
  throw lastError;
}

function isRetryable(err: unknown) {
  const status = (err as { status?: number }).status ?? statusFromMessage(err);
  return !!status && RETRYABLE.includes(status);
}

function statusFromMessage(err: unknown) {
  const m = err instanceof Error ? err.message.match(/"code":\s*(\d{3})/) : null;
  return m ? Number(m[1]) : undefined;
}
