import { NextResponse } from "next/server";
import { chooseConcept, createNextItem, ensureConceptByName, publicItem, takePreparedItem } from "@/lib/practice/engine";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Returns the next practice problem, and prepares the one after it in the background. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { conceptId?: string; courseId?: string; topic?: string; subject?: string };
  let conceptId = body.conceptId;
  if (!conceptId && body.topic?.trim()) {
    conceptId = (await ensureConceptByName(user.id, body.topic.trim(), body.subject?.trim() || null)).id;
  }
  conceptId = (await chooseConcept(user.id, { conceptId, courseId: body.courseId })) ?? undefined;
  if (!conceptId) return NextResponse.json({ error: "Tell Lumo what to practice, or ask a few questions in a video first." }, { status: 400 });

  const { data: concept } = await createAdminClient().from("concepts").select("name").eq("id", conceptId).eq("user_id", user.id).maybeSingle();
  if (!concept) return NextResponse.json({ error: "Concept not found" }, { status: 404 });

  try {
    const item = (await takePreparedItem(user.id, conceptId)) ?? (await createNextItem(user.id, conceptId));
    return NextResponse.json({ item: publicItem(item, concept.name) });
  } catch (err) {
    console.error("practice generation failed", err);
    return NextResponse.json({ error: "Couldn't write a problem right now. Try again in a moment." }, { status: 503 });
  }
}
