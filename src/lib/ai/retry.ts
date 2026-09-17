const RETRYABLE = [429, 500, 503, 504];

/** Retries Gemini calls that fail from overload or rate limits, with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status ?? statusFromMessage(err);
      if (!status || !RETRYABLE.includes(status) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i + Math.random() * 500));
    }
  }
  throw lastError;
}

function statusFromMessage(err: unknown) {
  const m = err instanceof Error ? err.message.match(/"code":\s*(\d{3})/) : null;
  return m ? Number(m[1]) : undefined;
}
