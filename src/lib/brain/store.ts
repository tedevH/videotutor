import { createAdminClient } from "@/lib/supabase/server";
import { applyEvidence, conceptSlug, effectiveMastery, masteryLevel, NEW_MASTERY, type Evidence, type MasteryState } from "./model";

/** Server-side writes to the student model. Students can read their data (RLS) but never write it. */

export type ConceptRef = { id: string; slug: string; name: string; subject: string | null };

export async function ensureConcept(
  userId: string,
  input: { name: string; subject?: string | null; description?: string | null; courseId?: string | null; unitId?: string | null; examWeight?: number },
): Promise<ConceptRef> {
  const db = createAdminClient();
  const slug = conceptSlug(input.name, input.subject);
  const { data: existing } = await db.from("concepts").select("id, slug, name, subject, course_id").eq("user_id", userId).eq("slug", slug).maybeSingle();
  if (existing) {
    // Attach to a course the first time it shows up in one.
    if (input.courseId && !existing.course_id) {
      await db.from("concepts").update({ course_id: input.courseId, unit_id: input.unitId ?? null }).eq("id", existing.id);
    }
    return existing;
  }
  const { data, error } = await db
    .from("concepts")
    .upsert(
      {
        user_id: userId,
        slug,
        name: input.name.trim().slice(0, 120),
        subject: input.subject ?? null,
        description: input.description ?? null,
        course_id: input.courseId ?? null,
        unit_id: input.unitId ?? null,
        exam_weight: input.examWeight ?? 1,
      },
      { onConflict: "user_id,slug" },
    )
    .select("id, slug, name, subject")
    .single();
  if (error) throw error;
  return data;
}

export async function getMastery(userId: string, conceptId: string): Promise<MasteryState> {
  const { data } = await createAdminClient()
    .from("mastery")
    .select("p_known, stability_days, attempts, correct, streak, signals, last_evidence_at, next_review_at")
    .eq("user_id", userId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  return data ?? NEW_MASTERY;
}

export async function recordEvidence(
  userId: string,
  conceptId: string,
  evidence: Evidence,
  meta: { source: string; sessionId?: string | null; modality?: string | null; detail?: Record<string, unknown> } = { source: "video" },
) {
  const db = createAdminClient();
  const before = await getMastery(userId, conceptId);
  const after = applyEvidence(before, evidence);
  await Promise.all([
    db.from("mastery").upsert({ user_id: userId, concept_id: conceptId, ...after, updated_at: new Date().toISOString() }, { onConflict: "user_id,concept_id" }),
    db.from("learning_events").insert({
      user_id: userId,
      concept_id: conceptId,
      kind: evidence.kind,
      correct: evidence.kind === "attempt" ? evidence.correct : null,
      modality: meta.modality ?? null,
      source: meta.source,
      session_id: meta.sessionId ?? null,
      detail: meta.detail ?? {},
    }),
  ]);
  return { before, after };
}

export const misconceptionKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9:/-]+/g, "-").slice(0, 120);

export async function recordMisconception(userId: string, conceptId: string | null, key: string, description: string) {
  const db = createAdminClient();
  const normalizedKey = misconceptionKey(key);
  const { data: existing } = await db.from("misconceptions").select("id, occurrences").eq("user_id", userId).eq("key", normalizedKey).maybeSingle();
  if (existing) {
    await db
      .from("misconceptions")
      .update({ occurrences: existing.occurrences + 1, last_seen_at: new Date().toISOString(), resolved_at: null, description })
      .eq("id", existing.id);
    return existing.id as string;
  }
  const { data } = await db
    .from("misconceptions")
    .insert({ user_id: userId, concept_id: conceptId, key: normalizedKey, description })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

export async function resolveMisconception(userId: string, key: string) {
  await createAdminClient().from("misconceptions").update({ resolved_at: new Date().toISOString() }).eq("user_id", userId).eq("key", misconceptionKey(key));
}

/** Credits (or not) the kind of explanation the student just saw, once we learn whether it landed. */
export async function recordModalityOutcome(userId: string, modality: string, worked: boolean) {
  const db = createAdminClient();
  const { data } = await db.from("modality_stats").select("shown, worked").eq("user_id", userId).eq("modality", modality).maybeSingle();
  await db.from("modality_stats").upsert(
    { user_id: userId, modality, shown: (data?.shown ?? 0) + 1, worked: (data?.worked ?? 0) + (worked ? 1 : 0) },
    { onConflict: "user_id,modality" },
  );
}

export type ConceptWithMastery = ConceptRef & {
  description: string | null;
  course_id: string | null;
  exam_weight: number;
  mastery: MasteryState;
  effective: number;
  level: ReturnType<typeof masteryLevel>;
};

export async function listConceptsWithMastery(userId: string, opts: { courseId?: string } = {}): Promise<ConceptWithMastery[]> {
  const db = createAdminClient();
  let query = db.from("concepts").select("id, slug, name, subject, description, course_id, exam_weight").eq("user_id", userId);
  if (opts.courseId) query = query.eq("course_id", opts.courseId);
  const [{ data: concepts }, { data: rows }] = await Promise.all([
    query,
    db.from("mastery").select("concept_id, p_known, stability_days, attempts, correct, streak, signals, last_evidence_at, next_review_at").eq("user_id", userId),
  ]);
  const byConcept = new Map((rows ?? []).map((r) => [r.concept_id as string, r as MasteryState & { concept_id: string }]));
  const now = Date.now();
  return (concepts ?? []).map((c) => {
    const mastery = byConcept.get(c.id) ?? NEW_MASTERY;
    return { ...c, mastery, effective: effectiveMastery(mastery, now), level: masteryLevel(mastery, now) };
  });
}
