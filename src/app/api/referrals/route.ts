import { NextResponse } from "next/server";
import { referralStatus } from "@/lib/referrals";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(await referralStatus(user.id));
}
