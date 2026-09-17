import { recall } from "./model";
import type { ConceptWithMastery } from "./store";

const DAY_MS = 86_400_000;

export type DueReview = { concept: ConceptWithMastery; recall: number; daysSince: number; message: string };

/** Concepts the student has learned but is likely forgetting, most urgent first. */
export function dueReviews(concepts: ConceptWithMastery[], now = Date.now()): DueReview[] {
  return concepts
    .filter((c) => c.mastery.last_evidence_at && c.mastery.p_known >= 0.45)
    .map((c) => {
      const r = recall(c.mastery, now);
      const daysSince = Math.round((now - new Date(c.mastery.last_evidence_at!).getTime()) / DAY_MS);
      const due = c.mastery.next_review_at ? new Date(c.mastery.next_review_at).getTime() <= now : r < 0.85;
      return { c, r, daysSince, due };
    })
    .filter((x) => x.due)
    .sort((a, b) => a.r * b.c.exam_weight - b.r * a.c.exam_weight)
    .map(({ c, r, daysSince }) => ({
      concept: c,
      recall: r,
      daysSince,
      message:
        daysSince >= 14
          ? `You haven't reviewed ${c.name} in ${Math.round(daysSince / 7)} weeks. Let's see what you remember.`
          : daysSince >= 3
            ? `${c.name} is starting to fade (${daysSince} days since you practiced). A quick check will lock it in.`
            : `Perfect time to review ${c.name}: recalling it now makes it stick much longer.`,
    }));
}
