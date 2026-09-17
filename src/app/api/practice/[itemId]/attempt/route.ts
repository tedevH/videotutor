import { after, NextResponse } from "next/server";
import { masteryLevel } from "@/lib/brain/model";
import { createNextItem, loadItem, submitAttempt } from "@/lib/practice/engine";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { answer } = (await request.json()) as { answer?: string };
  if (!answer?.trim()) return NextResponse.json({ error: "Write an answer first" }, { status: 400 });
  const item = await loadItem(user.id, itemId);
  if (!item) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

  try {
    const { grade, hints, masteryBefore, masteryAfter } = await submitAttempt(user.id, item, answer);
    // Get the next problem ready while the student reads the feedback.
    if (grade.result === "correct") {
      after(() => createNextItem(user.id, item.concept_id).catch((err) => console.error("pre-generation failed", err)));
    }
    return NextResponse.json({
      grade,
      hintsUsed: hints,
      solution: grade.result === "correct" ? { answer: item.solution.answer, steps: item.solution.steps } : null,
      mastery: {
        before: Math.round(masteryBefore.p_known * 100),
        after: Math.round(masteryAfter.p_known * 100),
        level: masteryLevel(masteryAfter),
      },
    });
  } catch (err) {
    console.error("grading failed", err);
    return NextResponse.json({ error: "Couldn't check that answer right now. Try again in a moment." }, { status: 503 });
  }
}
