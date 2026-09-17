import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordReferral, REFERRAL_COOKIE } from "@/lib/referrals";
import { createClient } from "@/lib/supabase/server";

/** Credits the invite link a new user arrived with (password sign-ups don't pass through /auth/callback). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const cookieStore = await cookies();
  const code = cookieStore.get(REFERRAL_COOKIE)?.value;
  if (code) {
    await recordReferral(user.id, code).catch((err) => console.error("referral failed", err));
    cookieStore.delete(REFERRAL_COOKIE);
  }
  return NextResponse.json({ ok: true });
}
