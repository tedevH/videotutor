/**
 * The math of the student model. Pure functions, no I/O.
 *
 * Knowledge: Bayesian Knowledge Tracing (probability the concept is learned).
 * Memory:    recall decays as R(t) = 0.9^(t / S), where S ("stability") is the number of days
 *            until recall drops to 90%. Successful retrieval grows S; failure shrinks it.
 * Effective mastery = knowledge × recall, which is what scheduling and difficulty use.
 */

export type MasteryState = {
  p_known: number;
  stability_days: number;
  attempts: number;
  correct: number;
  streak: number;
  signals: number;
  last_evidence_at: string | null;
  next_review_at: string | null;
};

export const NEW_MASTERY: MasteryState = {
  p_known: 0.2,
  stability_days: 1,
  attempts: 0,
  correct: 0,
  streak: 0,
  signals: 0,
  last_evidence_at: null,
  next_review_at: null,
};

/** Evidence about a concept, from graded practice or from conversation. */
export type Evidence =
  | { kind: "attempt"; correct: boolean; hintsUsed?: number; difficulty?: Difficulty }
  | { kind: "understood" }
  | { kind: "confused" }
  | { kind: "misconception" }
  | { kind: "asked" };

export type Difficulty = "easy" | "medium" | "hard" | "transfer";

const BKT = { learn: 0.15, slip: 0.1, guess: 0.2 };
const DAY_MS = 86_400_000;
const REVIEW_AT_RECALL = 0.85;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Probability the student can still recall the concept right now. */
export function recall(state: Pick<MasteryState, "stability_days" | "last_evidence_at">, now = Date.now()) {
  if (!state.last_evidence_at) return 1;
  const days = Math.max(0, (now - new Date(state.last_evidence_at).getTime()) / DAY_MS);
  return Math.pow(0.9, days / Math.max(0.1, state.stability_days));
}

export function effectiveMastery(state: MasteryState, now = Date.now()) {
  return state.p_known * recall(state, now);
}

/** Days from now until recall falls to the review threshold. */
function daysUntilReview(stability: number) {
  return (stability * Math.log(REVIEW_AT_RECALL)) / Math.log(0.9);
}

/** Standard BKT posterior after observing a correct/incorrect response, then the learning step. */
function bktUpdate(p: number, correct: boolean, strength = 1) {
  const { slip, guess, learn } = BKT;
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  // Soft evidence (e.g. "seemed to understand" in chat) moves the estimate only part of the way.
  const blended = p + (posterior - p) * strength;
  return blended + (1 - blended) * learn * strength;
}

export function applyEvidence(state: MasteryState, evidence: Evidence, now = Date.now()): MasteryState {
  const next = { ...state };
  const currentRecall = recall(state, now);
  let success: boolean | null = null;

  switch (evidence.kind) {
    case "attempt": {
      // Hints and easy problems are weaker evidence of mastery.
      const hintPenalty = Math.min(0.6, (evidence.hintsUsed ?? 0) * 0.2);
      const difficultyWeight = { easy: 0.7, medium: 1, hard: 1.2, transfer: 1.3 }[evidence.difficulty ?? "medium"];
      const strength = clamp((evidence.correct ? 1 - hintPenalty : 1) * difficultyWeight, 0.3, 1);
      next.p_known = bktUpdate(state.p_known * currentRecall, evidence.correct, strength);
      next.attempts += 1;
      next.correct += evidence.correct ? 1 : 0;
      next.streak = evidence.correct ? state.streak + 1 : 0;
      success = evidence.correct;
      break;
    }
    case "understood":
      next.p_known = bktUpdate(state.p_known * currentRecall, true, 0.35);
      next.signals += 1;
      success = true;
      break;
    case "confused":
      next.p_known = bktUpdate(state.p_known, false, 0.4);
      next.signals += 1;
      success = false;
      break;
    case "misconception":
      next.p_known = bktUpdate(state.p_known, false, 0.6);
      next.signals += 1;
      next.streak = 0;
      success = false;
      break;
    case "asked":
      next.signals += 1;
      break;
  }

  if (success !== null) {
    // Retrieval after some forgetting strengthens memory more ("desirable difficulty").
    next.stability_days = success
      ? clamp(state.stability_days * (1.6 + 1.4 * (1 - currentRecall)), 0.5, 365)
      : clamp(state.stability_days * 0.5, 0.5, 365);
    next.last_evidence_at = new Date(now).toISOString();
    next.next_review_at = new Date(now + daysUntilReview(next.stability_days) * DAY_MS).toISOString();
  }
  next.p_known = clamp(next.p_known, 0.01, 0.99);
  return next;
}

export type MasteryLevel = "new" | "shaky" | "developing" | "solid" | "mastered";

export function masteryLevel(state: MasteryState, now = Date.now()): MasteryLevel {
  if (state.attempts === 0 && state.signals === 0) return "new";
  const m = effectiveMastery(state, now);
  if (m < 0.35) return "shaky";
  // Conversation alone can't prove mastery; it takes graded work.
  if (m < 0.6 || state.attempts === 0) return "developing";
  if (m < 0.85 || state.attempts < 3) return "solid";
  return "mastered";
}

/** Difficulty ladder: struggling → easy; mastering → hard, then transfer to new contexts. */
export function nextDifficulty(state: MasteryState, recentResults: boolean[], now = Date.now()): Difficulty {
  const m = effectiveMastery(state, now);
  let level: Difficulty = m < 0.4 ? "easy" : m < 0.65 ? "medium" : m < 0.85 ? "hard" : "transfer";
  const lastTwo = recentResults.slice(-2);
  const order: Difficulty[] = ["easy", "medium", "hard", "transfer"];
  if (lastTwo.length === 2 && lastTwo.every((r) => !r)) level = order[Math.max(0, order.indexOf(level) - 1)];
  if (recentResults.slice(-3).length === 3 && recentResults.slice(-3).every(Boolean)) level = order[Math.min(3, order.indexOf(level) + 1)];
  return level;
}

/** Mechanics solid but recognition untested or weak → ask recognition questions instead of more drills. */
export function nextProblemKind(history: { kind: string; correct: boolean }[]): "compute" | "recognize" | "explain" {
  const by = (k: string) => history.filter((h) => h.kind === k);
  const computeOk = by("compute").slice(-2).length === 2 && by("compute").slice(-2).every((h) => h.correct);
  const recognize = by("recognize").slice(-2);
  if (computeOk && (recognize.length < 2 || !recognize.every((h) => h.correct))) return "recognize";
  if (computeOk && recognize.every((h) => h.correct) && by("explain").length === 0) return "explain";
  return "compute";
}

/** Normalizes a concept name into a stable identifier within a subject. */
export function conceptSlug(name: string, subject?: string | null) {
  const s = (x: string) =>
    x
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const topic = subject ? s(subject.split(":")[0]) : "";
  return topic ? `${topic}/${s(name)}` : s(name);
}
