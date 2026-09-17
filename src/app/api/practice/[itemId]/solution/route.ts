import { NextResponse } from "next/server";
import { recordEvidence } from "@/lib/brain/store";
import { loadItem } from "@/lib/practice/engine";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Shows the worked solution. Giving up counts as an unsuccessful attempt (once). */
export async function POST(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const item = await loadItem(user.id, itemId);
  if (!item) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

  const db = createAdminClient();
  const { data: attempts } = await db.from("practice_attempts").select("correct").eq("item_id", itemId).eq("user_id", user.id);
  if (!attempts?.some((a) => a.correct)) {
    await db.from("practice_attempts").insert({ user_id: user.id, item_id: itemId, answer: "(revealed solution)", correct: false, diagnosis: { result: "gave_up" } });
    if (!attempts?.length) {
      await recordEvidence(user.id, item.concept_id, { kind: "attempt", correct: false, difficulty: item.difficulty }, { source: "practice", detail: { item_id: itemId, gave_up: true } });
    }
  }
  return NextResponse.json({ answer: item.solution.answer, steps: item.solution.steps, common_mistakes: item.solution.common_mistakes });
}
