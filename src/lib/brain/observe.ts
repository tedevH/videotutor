import { createAdminClient } from "@/lib/supabase/server";
import type { TutorResponse } from "@/lib/tutor/schema";
import { ensureConcept, recordEvidence, recordMisconception, recordModalityOutcome, resolveMisconception } from "./store";

/** The kind of explanation a tutor reply used, for learning which modalities work for a student. */
export function modalityOf(response: Pick<TutorResponse, "blocks" | "move">) {
  const visual = response.blocks.find((b) => b.type !== "text" && b.type !== "check_question");
  if (visual) return visual.type === "steps" ? "worked steps" : visual.type === "frame" ? "annotated frame" : visual.type;
  if (response.move === "example") return "example";
  if (response.move === "question" || response.move === "hint") return "guided questions";
  return "text";
}

/**
 * Feeds one tutor turn into the student model: concept evidence, misconceptions, and whether the
 * previous explanation style worked. Never throws; learning updates must not break tutoring.
 */
export async function learnFromTurn(opts: {
  userId: string;
  sessionId: string | null;
  source: string;
  response: TutorResponse;
  previousTutorReply: TutorResponse | null;
  courseId?: string | null;
}) {
  const { userId, sessionId, response, previousTutorReply } = opts;
  try {
    for (const o of response.observations.slice(0, 4)) {
      if (!o.concept.trim()) continue;
      const concept = await ensureConcept(userId, { name: o.concept, subject: o.subject || null, courseId: opts.courseId });
      const modality = previousTutorReply ? modalityOf(previousTutorReply) : null;
      await recordEvidence(userId, concept.id, { kind: o.signal }, { source: opts.source, sessionId, modality, detail: { assessment: response.assessment } });
      if (o.signal === "misconception" && o.misconception_key && o.misconception) {
        await recordMisconception(userId, concept.id, o.misconception_key, o.misconception);
      }
    }

    // Did the explanation we gave last time land? The student's reply is the evidence.
    if (previousTutorReply && response.assessment.result !== "not_applicable") {
      const worked = response.assessment.result === "correct";
      await recordModalityOutcome(userId, modalityOf(previousTutorReply), worked);
      if (worked) {
        for (const o of previousTutorReply.observations) {
          if (o.signal === "misconception" && o.misconception_key) await resolveMisconception(userId, o.misconception_key);
        }
      }
    }
  } catch (err) {
    console.error("student model update failed", err);
  }
}

export async function lastTutorReply(sessionId: string): Promise<TutorResponse | null> {
  const { data } = await createAdminClient()
    .from("messages")
    .select("content")
    .eq("session_id", sessionId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const content = data?.content as TutorResponse | undefined;
  return content?.blocks ? { ...content, observations: content.observations ?? [], move: content.move ?? "explain" } : null;
}
