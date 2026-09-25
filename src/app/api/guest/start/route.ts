import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SOURCE_COOKIE } from "@/lib/guest";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Records where a new visitor came from, so 100 users teaches you which channel worked. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const source = (await cookies()).get(SOURCE_COOKIE)?.value;
  if (source) {
    await createAdminClient().from("profiles").update({ ref_source: source.slice(0, 40) }).eq("id", user.id).is("ref_source", null);
  }
  return NextResponse.json({ ok: true });
}
