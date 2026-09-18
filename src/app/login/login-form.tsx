"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

type Mode = "signin" | "signup" | "forgot";

/**
 * Every account uses email + password (sessions persist for months).
 * "Forgot password" also lets older link-only accounts set a password.
 */
export function LoginForm({ next, initialMode = "signin" }: { next: string; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const callbackUrl = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  async function finishSignIn() {
    // Credit an invite link if they arrived through one, then go.
    await fetch("/api/referrals/claim", { method: "POST" }).catch(() => null);
    router.push(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        return setError(
          error.message.includes("Email not confirmed")
            ? "Confirm your email first. Check your inbox for the link we sent when you signed up."
            : "Wrong email or password. If you've only used email links before, use “Forgot password” to set one.",
        );
      }
      return finishSignIn();
    }

    if (mode === "signup") {
      if (password.length < 8) {
        setBusy(false);
        return setError("Use at least 8 characters.");
      }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl(next) } });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) return finishSignIn();
      // Supabase returns a user with no identities (and sends no email) when the address is already registered.
      if (data.user && data.user.identities?.length === 0) {
        setMode("forgot");
        return setError("You already have an account with this email. Send yourself a reset link below to set a password.");
      }
      return setNotice("Almost done: confirm your email with the link we just sent. You only do this once; after that, sign in with your password.");
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl("/reset-password") });
    setBusy(false);
    if (resetError) return setError(resetError.message);
    setNotice("Check your email for a link to set a new password.");
  }

  async function google() {
    await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
  }

  const title = { signin: "Sign in", signup: "Create your account", forgot: "Reset your password" }[mode];

  return (
    <div className="mt-6">
      {(mode === "signin" || mode === "signup") && (
        <div className="mb-4 grid grid-cols-2 rounded-full bg-stone-100 p-1 text-sm" role="tablist">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setError(null);
                setNotice(null);
              }}
              className={`rounded-full py-1.5 font-medium ${mode === value ? "bg-white shadow-sm" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "forgot" && <p className="mb-3 font-semibold">{title}</p>}

      {GOOGLE_ENABLED && (mode === "signin" || mode === "signup") && (
        <>
          <button onClick={google} className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50">
            Continue with Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email (school one preferred)"
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        {(mode === "signin" || mode === "signup") && (
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Create a password (8+ characters)" : "Password"}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        )}
        <button disabled={busy} className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "One sec…" : { signin: "Sign in", signup: "Create account", forgot: "Send reset link" }[mode]}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{notice}</p>}

      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        {mode === "signin" && (
          <button onClick={() => setMode("forgot")} className="text-muted hover:text-foreground">
            Forgot password?
          </button>
        )}
        {mode === "forgot" && (
          <button onClick={() => setMode("signin")} className="text-muted hover:text-foreground">
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
