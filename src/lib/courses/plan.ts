import type { ConceptWithMastery } from "@/lib/brain/store";

export type PlanDay = { date: string; label: string; items: { conceptId: string; name: string; minutes: number; reason: string }[] };

const DAY_MS = 86_400_000;
const MINUTES_PER_DAY = 45;

/**
 * Exam study plan. Priority = how much the concept matters × how far from mastered it is, plus a boost
 * for concepts that other weak concepts depend on. Prerequisites are scheduled before what depends on them;
 * the final day is mixed review of the weakest material.
 */
export function buildStudyPlan(
  concepts: ConceptWithMastery[],
  prerequisites: { concept_id: string; prerequisite_id: string }[],
  examDate: string | null,
  today = new Date(),
): { daysLeft: number | null; days: PlanDay[]; focus: { conceptId: string; name: string; priority: number; reason: string }[] } {
  const start = new Date(today.toISOString().slice(0, 10));
  const daysLeft = examDate ? Math.max(0, Math.round((new Date(examDate).getTime() - start.getTime()) / DAY_MS)) : null;
  const byId = new Map(concepts.map((c) => [c.id, c]));

  const dependents = new Map<string, string[]>();
  for (const p of prerequisites) dependents.set(p.prerequisite_id, [...(dependents.get(p.prerequisite_id) ?? []), p.concept_id]);

  const scored = concepts
    .map((c) => {
      const gap = 1 - c.effective;
      const unlocks = (dependents.get(c.id) ?? []).filter((d) => (byId.get(d)?.effective ?? 0) < 0.6).length;
      const priority = c.exam_weight * gap * (1 + 0.35 * unlocks);
      const reason =
        c.level === "new"
          ? "not studied yet"
          : c.level === "shaky"
            ? "you've struggled with this"
            : c.mastery.last_evidence_at && c.effective < c.mastery.p_known * 0.8
              ? "you're starting to forget it"
              : unlocks
                ? `needed for ${unlocks} other weak topic${unlocks > 1 ? "s" : ""}`
                : c.level === "developing"
                  ? "almost there"
                  : "keep it fresh";
      return { c, priority, reason };
    })
    .filter((s) => s.c.level !== "mastered" || s.c.effective < 0.8)
    .sort((a, b) => b.priority - a.priority);

  const focus = scored.slice(0, 12).map((s) => ({ conceptId: s.c.id, name: s.c.name, priority: Number(s.priority.toFixed(2)), reason: s.reason }));

  // Order the chosen concepts so prerequisites come first (stable within priority).
  const chosen = new Set(scored.slice(0, 30).map((s) => s.c.id));
  const ordered: typeof scored = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || !chosen.has(id)) return;
    visited.add(id);
    for (const p of prerequisites.filter((p) => p.concept_id === id)) visit(p.prerequisite_id);
    const entry = scored.find((s) => s.c.id === id);
    if (entry) ordered.push(entry);
  };
  for (const s of scored) visit(s.c.id);

  const totalDays = Math.max(1, Math.min(daysLeft ?? 7, 21));
  const studyDays = totalDays > 1 ? totalDays - 1 : 1;
  const days: PlanDay[] = [];
  let cursor = 0;
  for (let d = 0; d < studyDays && cursor < ordered.length; d++) {
    const date = new Date(start.getTime() + d * DAY_MS);
    const items: PlanDay["items"] = [];
    let budget = MINUTES_PER_DAY;
    while (cursor < ordered.length && budget > 10) {
      const { c, reason } = ordered[cursor];
      const minutes = Math.round(Math.min(35, 10 + 25 * (1 - c.effective)) / 5) * 5;
      items.push({ conceptId: c.id, name: c.name, minutes, reason });
      budget -= minutes;
      cursor++;
    }
    days.push({ date: date.toISOString().slice(0, 10), label: d === 0 ? "Today" : d === 1 ? "Tomorrow" : date.toLocaleDateString("en-US", { weekday: "long" }), items });
  }
  if (daysLeft !== null && daysLeft >= 1) {
    const reviewDate = new Date(start.getTime() + (totalDays - 1) * DAY_MS);
    days.push({
      date: reviewDate.toISOString().slice(0, 10),
      label: "Final review",
      items: focus.slice(0, 4).map((f) => ({ conceptId: f.conceptId, name: f.name, minutes: 10, reason: "mixed review of your weakest topics" })),
    });
  }
  return { daysLeft, days, focus };
}
