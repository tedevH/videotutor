import { NextResponse } from "next/server";
import { REFERRAL_COOKIE } from "@/lib/referrals";

/** Referral link: remember who invited this visitor, then send them to sign up. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/login?next=/home&invited=1", url.origin));
  if (/^[a-z0-9]{6,16}$/i.test(code)) {
    response.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", path: "/" });
  }
  return response;
}
