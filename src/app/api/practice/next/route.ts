import { NextResponse } from "next/server";
import { chooseConcept, createNextItem, ensureConceptByName, publicItem, takePreparedItem } from "@/lib/practice/engine";
import { planFor } from "@/lib/entitlements";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Returns the next practice problem, and prepares the one after it in the background. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { conceptId?: string; courseId?: string; topic?: string; subject?: string; review?: boolean };
  let conceptId = body.conceptId;
  if (!conceptId && body.topic?.trim()) {
    conceptId = (await ensureConceptByName(user.id, body.topic.trim(), body.subject?.trim() || null)).id;
  }
  conceptId = (await chooseConcept(user.id, { conceptId, courseId: body.courseId, review: body.review })) ?? undefined;
  if (!conceptId) return NextResponse.json({ error: "Tell Lumo what to practice, or ask a few questions in a video first." }, { status: 400 });

  const db = createAdminClient();
  const [{ plan, limits }, { count: todayCount }] = await Promise.all([
    planFor(user.id),
    db.from("practice_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
  ]);
  const { data: concept } = await db.from("concepts").select("name").eq("id", conceptId).eq("user_id", user.id).maybeSingle();
  if (!concept) return NextResponse.json({ error: "Concept not found" }, { status: 404 });

  try {
    const prepared = await takePreparedItem(user.id, conceptId);
    if (!prepared && (todayCount ?? 0) >= limits.practiceProblemsPerDay) {
      return NextResponse.json(
        {
          error:
            plan === "free"
              ? `The Free plan includes ${limits.practiceProblemsPerDay} practice problems a day. Plus includes 60, or invite 2 friends to unlock 14 days of Plus.`
              : `You've done ${limits.practiceProblemsPerDay} problems today. Nice work! More tomorrow.`,
          upgrade: plan !== "pro",
        },
        { status: 429 },
      );
    }
    const item = prepared ?? (await createNextItem(user.id, conceptId));
    return NextResponse.json({ item: publicItem(item, concept.name) });
  } catch (err) {
    console.error("practice generation failed", err);
    return NextResponse.json({ error: "Couldn't write a problem right now. Try again in a moment." }, { status: 503 });
  }
}
