import { createAdminClient } from "@/lib/supabase/server";
import { recall } from "./model";
import { listConceptsWithMastery } from "./store";

const DAY_MS = 86_400_000;

/**
 * A compact, prompt-ready summary of what Lumo knows about a student, focused on the subject at hand
 * (falls back to everything when the subject is unknown).
 */
export async function studentModelSummary(userId: string, subjectHint = ""): Promise<string> {
  const db = createAdminClient();
  const [concepts, { data: misconceptions }, { data: modalities }, { data: recent }] = await Promise.all([
    listConceptsWithMastery(userId),
    db
      .from("misconceptions")
      .select("description, occurrences, last_seen_at, concept_id")
      .eq("user_id", userId)
      .is("resolved_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(8),
    db.from("modality_stats").select("modality, shown, worked").eq("user_id", userId),
    db.from("learning_events").select("kind, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);

  if (!concepts.length && !misconceptions?.length) return "";

  const topic = subjectHint.toLowerCase().split(":")[0].trim();
  const relevant = concepts.filter((c) => !topic || (c.subject ?? "").toLowerCase().includes(topic) || c.slug.startsWith(topic.replace(/\s+/g, "-")));
  const pool = relevant.length ? relevant : concepts;
  const now = Date.now();
  const describe = (c: (typeof pool)[number]) => {
    const since = c.mastery.last_evidence_at ? Math.round((now - new Date(c.mastery.last_evidence_at).getTime()) / DAY_MS) : null;
    const graded = c.mastery.attempts ? `, ${c.mastery.correct}/${c.mastery.attempts} practice correct` : "";
    const fading = since !== null && recall(c.mastery, now) < 0.75 ? `, not reviewed in ${since} days` : "";
    return `${c.name} (${c.level}${graded}${fading})`;
  };

  const shaky = pool.filter((c) => c.level === "shaky" || c.level === "developing").sort((a, b) => a.effective - b.effective).slice(0, 8);
  const strong = pool.filter((c) => c.level === "solid" || c.level === "mastered").sort((a, b) => b.effective - a.effective).slice(0, 8);
  const names = new Map(concepts.map((c) => [c.id, c.name]));

  const lines: string[] = [];
  if (strong.length) lines.push(`Strong: ${strong.map(describe).join("; ")}`);
  if (shaky.length) lines.push(`Shaky: ${shaky.map(describe).join("; ")}`);
  if (misconceptions?.length) {
    lines.push(
      `Known misconceptions (unresolved): ${misconceptions
        .map((m) => `${m.description}${m.concept_id && names.get(m.concept_id) ? ` [${names.get(m.concept_id)}]` : ""}${m.occurrences > 1 ? ` (seen ${m.occurrences}×)` : ""}`)
        .join(" | ")}`,
    );
  }
  const rated = (modalities ?? []).filter((m) => m.shown >= 2).map((m) => ({ ...m, rate: m.worked / m.shown }));
  if (rated.length) {
    const sorted = rated.sort((a, b) => b.rate - a.rate);
    lines.push(`Explanations that work for them: ${sorted.map((m) => `${m.modality} ${Math.round(m.rate * 100)}% (${m.worked}/${m.shown})`).join(", ")}`);
  }
  const confusedRecently = (recent ?? []).filter((e) => e.kind === "confused" || e.kind === "misconception").length;
  if (recent?.length) lines.push(`Recent activity: ${recent.length} learning events, ${confusedRecently} showed confusion.`);
  return lines.join("\n");
}
