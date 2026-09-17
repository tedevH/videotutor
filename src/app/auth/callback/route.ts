import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordReferral, REFERRAL_COOKIE } from "@/lib/referrals";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Credit the friend who invited them (only counts for brand-new accounts).
      const cookieStore = await cookies();
      const referral = cookieStore.get(REFERRAL_COOKIE)?.value;
      if (referral && data.user) {
        await recordReferral(data.user.id, referral).catch((err) => console.error("referral failed", err));
        cookieStore.delete(REFERRAL_COOKIE);
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
