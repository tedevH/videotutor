import { nextDifficulty, nextProblemKind, type Difficulty } from "@/lib/brain/model";
import { dueReviews } from "@/lib/brain/review";
import { ensureConcept, getMastery, listConceptsWithMastery, recordEvidence, recordMisconception, resolveMisconception } from "@/lib/brain/store";
import { createAdminClient } from "@/lib/supabase/server";
import { generateProblem } from "./generate";
import { gradeAttempt } from "./grade";
import type { PracticeItem } from "./schema";

const ITEM_COLUMNS = "id, concept_id, difficulty, kind, prompt, choices, solution, targets_misconception";

/**
 * Picks what to practice: the requested concept, or the weakest concept (in a course, if given) whose
 * prerequisites are in decent shape — a shaky prerequisite gets practiced first.
 */
export async function chooseConcept(userId: string, opts: { conceptId?: string; courseId?: string; review?: boolean }) {
  if (opts.conceptId) return opts.conceptId;
  const concepts = await listConceptsWithMastery(userId, { courseId: opts.courseId });
  if (!concepts.length) return null;
  // Review mode: the concept most at risk of being forgotten.
  if (opts.review) {
    const due = dueReviews(concepts);
    if (due.length) return due[0].concept.id;
  }

  const db = createAdminClient();
  const { data: prereqs } = await db
    .from("concept_prerequisites")
    .select("concept_id, prerequisite_id")
    .in("concept_id", concepts.map((c) => c.id));
  const byId = new Map(concepts.map((c) => [c.id, c]));
  // Weighted by exam importance; never-seen concepts get a mild priority so the student's map fills in.
  const priority = (c: (typeof concepts)[number]) => (1 - c.effective) * c.exam_weight + (c.level === "new" ? 0.1 : 0);
  const ranked = [...concepts].sort((a, b) => priority(b) - priority(a));

  const top = ranked[0];
  const weakPrereq = (prereqs ?? [])
    .filter((p) => p.concept_id === top.id)
    .map((p) => byId.get(p.prerequisite_id))
    .find((p) => p && p.effective < 0.45);
  return weakPrereq?.id ?? top.id;
}

async function planNext(userId: string, conceptId: string) {
  const db = createAdminClient();
  const [{ data: concept }, mastery, { data: history }, { data: misconception }, { data: profile }] = await Promise.all([
    db.from("concepts").select("id, name, subject, description").eq("id", conceptId).single(),
    getMastery(userId, conceptId),
    db
      .from("practice_attempts")
      .select("correct, created_at, practice_items!inner(concept_id, kind, prompt)")
      .eq("user_id", userId)
      .eq("practice_items.concept_id", conceptId)
      .order("created_at", { ascending: true })
      .limit(30),
    db
      .from("misconceptions")
      .select("id, description")
      .eq("user_id", userId)
      .eq("concept_id", conceptId)
      .is("resolved_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("profiles").select("school_level").eq("id", userId).maybeSingle(),
  ]);
  if (!concept) throw new Error("Concept not found");

  const attempts = (history ?? []).map((h) => {
    const item = h.practice_items as unknown as { kind: string; prompt: string };
    return { correct: h.correct, kind: item.kind, prompt: item.prompt };
  });
  const difficulty: Difficulty = nextDifficulty(mastery, attempts.map((a) => a.correct));
  // An active misconception takes precedence: target it directly with a computation that exposes it.
  const kind = misconception ? "compute" : nextProblemKind(attempts);
  return { concept, difficulty, kind, misconception, recentPrompts: attempts.slice(-6).map((a) => a.prompt), level: profile?.school_level ?? "college" };
}

export async function createNextItem(userId: string, conceptId: string): Promise<PracticeItem> {
  const plan = await planNext(userId, conceptId);
  const draft = await generateProblem({
    userId,
    concept: plan.concept.name,
    subject: plan.concept.subject,
    description: plan.concept.description,
    difficulty: plan.difficulty,
    kind: plan.kind,
    misconception: plan.misconception?.description ?? null,
    recentPrompts: plan.recentPrompts,
    level: plan.level,
  });
  const { data, error } = await createAdminClient()
    .from("practice_items")
    .insert({
      user_id: userId,
      concept_id: conceptId,
      difficulty: plan.difficulty,
      kind: draft.choices?.length ? "choice" : plan.kind,
      prompt: draft.prompt,
      choices: draft.choices?.length ? draft.choices : null,
      solution: draft,
      targets_misconception: plan.misconception?.id ?? null,
    })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;
  return data as PracticeItem;
}

/** An already-prepared, unattempted problem for this concept, if the background generator made one. */
export async function takePreparedItem(userId: string, conceptId: string): Promise<PracticeItem | null> {
  const db = createAdminClient();
  const { data: items } = await db
    .from("practice_items")
    .select(`${ITEM_COLUMNS}, practice_attempts(id)`)
    .eq("user_id", userId)
    .eq("concept_id", conceptId)
    .order("created_at", { ascending: false })
    .limit(5);
  const fresh = (items ?? []).find((i) => !(i.practice_attempts as unknown as unknown[]).length);
  if (!fresh) return null;
  const { id, concept_id, difficulty, kind, prompt, choices, solution, targets_misconception } = fresh;
  return { id, concept_id, difficulty, kind, prompt, choices, solution, targets_misconception } as PracticeItem;
}

export async function ensureConceptByName(userId: string, name: string, subject: string | null) {
  return ensureConcept(userId, { name, subject });
}

/** Public view of an item: never includes the answer key. */
export function publicItem(item: PracticeItem, conceptName: string) {
  return {
    id: item.id,
    concept_id: item.concept_id,
    concept: conceptName,
    difficulty: item.difficulty,
    kind: item.kind,
    prompt: item.prompt,
    choices: item.choices,
    hints_available: item.solution.hints.length,
    targets_misconception: !!item.targets_misconception,
  };
}

export async function loadItem(userId: string, itemId: string) {
  const { data } = await createAdminClient().from("practice_items").select(ITEM_COLUMNS).eq("id", itemId).eq("user_id", userId).maybeSingle();
  return (data as PracticeItem | null) ?? null;
}

/** Hints revealed so far, counted server-side so they can't be hidden from the mastery update. */
export async function hintsUsed(userId: string, itemId: string) {
  const { count } = await createAdminClient()
    .from("learning_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "hint")
    .eq("detail->>item_id", itemId);
  return count ?? 0;
}

export async function submitAttempt(userId: string, item: PracticeItem, answer: string) {
  const db = createAdminClient();
  const [grade, hints] = await Promise.all([gradeAttempt(item, answer, userId), hintsUsed(userId, item.id)]);
  const correct = grade.result === "correct";

  await db.from("practice_attempts").insert({
    user_id: userId,
    item_id: item.id,
    answer: answer.slice(0, 4000),
    correct,
    hints_used: hints,
    diagnosis: grade,
  });
  const { before, after } = await recordEvidence(
    userId,
    item.concept_id,
    { kind: "attempt", correct, hintsUsed: hints, difficulty: item.difficulty },
    { source: "practice", detail: { item_id: item.id, result: grade.result, diagnosis: grade.diagnosis } },
  );

  if (!correct && grade.misconception_key && grade.misconception) {
    await recordMisconception(userId, item.concept_id, grade.misconception_key, grade.misconception);
  }
  // Getting a problem right that was built to expose a misconception is evidence it's fixed.
  if (correct && item.targets_misconception) {
    const { data: m } = await db.from("misconceptions").select("key").eq("id", item.targets_misconception).maybeSingle();
    if (m) await resolveMisconception(userId, m.key);
  }
  return { grade, hints, masteryBefore: before, masteryAfter: after };
}
