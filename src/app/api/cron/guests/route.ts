import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const KEEP_DAYS = 30;

/**
 * Deletes guests who never came back. Anonymous accounts accumulate forever otherwise: one per
 * visitor, most of whom ask nothing. Vercel Cron calls this daily.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const { data: stale } = await db.from("profiles").select("id").eq("is_guest", true).lt("created_at", cutoff).limit(200);

  let deleted = 0;
  for (const profile of stale ?? []) {
    // Keep guests who actually used it: their questions are the most useful data we have.
    const { count } = await db.from("messages").select("id, sessions!inner(user_id)", { count: "exact", head: true }).eq("sessions.user_id", profile.id);
    if ((count ?? 0) > 0) continue;
    const { error } = await db.auth.admin.deleteUser(profile.id);
    if (!error) deleted++;
  }
  return NextResponse.json({ checked: stale?.length ?? 0, deleted });
}
