import { NextResponse } from "next/server";
import { hintsUsed, loadItem } from "@/lib/practice/engine";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Reveals the next hint and logs it, so mastery credit reflects the help that was used. */
export async function POST(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const item = await loadItem(user.id, itemId);
  if (!item) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

  const used = await hintsUsed(user.id, itemId);
  if (used >= item.solution.hints.length) return NextResponse.json({ hints: item.solution.hints, done: true });

  await createAdminClient()
    .from("learning_events")
    .insert({ user_id: user.id, concept_id: item.concept_id, kind: "hint", source: "practice", detail: { item_id: itemId, index: used } });
  // Hints aren't failures; they reduce the mastery credit when the attempt is graded.
  return NextResponse.json({ hints: item.solution.hints.slice(0, used + 1), done: used + 1 >= item.solution.hints.length });
}
