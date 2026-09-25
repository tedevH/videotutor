import { createClient } from "@/lib/supabase/client";

/** Where the visitor came from (?ref=library), kept in a cookie until their profile exists. */
export const SOURCE_COOKIE = "lumo_src";

export function rememberSource() {
  if (typeof document === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref) return;
  document.cookie = `${SOURCE_COOKIE}=${encodeURIComponent(ref.slice(0, 40))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

/**
 * Signs the visitor in anonymously so they can use Lumo before deciding to make an account.
 * Supabase gives them a real user row (flagged is_anonymous), so everything they do is theirs
 * and carries over when they add an email later.
 */
export async function ensureGuestSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  rememberSource();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  // Record where they came from; failure here shouldn't stop them using the product.
  await fetch("/api/guest/start", { method: "POST" }).catch(() => null);
  return data.user;
}
