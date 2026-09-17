import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { listConceptsWithMastery } from "@/lib/brain/store";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lumo Brain · LumoTutor" };

const LEVEL_COLOR: Record<string, string> = {
  new: "bg-stone-300",
  shaky: "bg-red-500",
  developing: "bg-amber-500",
  solid: "bg-sky-500",
  mastered: "bg-green-600",
};

const EVENT_LABEL: Record<string, string> = {
  asked: "asked about",
  confused: "was confused by",
  understood: "showed understanding of",
  misconception: "revealed a misconception in",
  attempt: "practiced",
  hint: "used a hint on",
  review: "reviewed",
  feedback: "gave feedback on",
};

/** Everything Lumo believes about the student, in the open. */
export default async function BrainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/brain");

  const [concepts, { data: misconceptions }, { data: modalities }, { data: events }] = await Promise.all([
    listConceptsWithMastery(user.id).catch(() => []),
    supabase.from("misconceptions").select("id, description, occurrences, first_seen_at, last_seen_at, resolved_at, concept_id").order("last_seen_at", { ascending: false }).limit(30),
    supabase.from("modality_stats").select("modality, shown, worked").order("shown", { ascending: false }),
    supabase.from("learning_events").select("id, kind, correct, concept_id, created_at, source").order("created_at", { ascending: false }).limit(25),
  ]);

  const names = new Map(concepts.map((c) => [c.id, c.name]));
  const bySubject = new Map<string, typeof concepts>();
  for (const c of concepts) {
    const key = (c.subject ?? "Other").split(":")[0].trim() || "Other";
    bySubject.set(key, [...(bySubject.get(key) ?? []), c]);
  }
  const active = (misconceptions ?? []).filter((m) => !m.resolved_at);
  const resolved = (misconceptions ?? []).filter((m) => m.resolved_at);

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <AppNav current="/brain" />
        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Lumo Brain</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          What Lumo has learned about how you learn: what you&apos;ve mastered, what&apos;s fading, the mistakes you tend to make, and the explanations that work for you. It updates every time you ask, answer, or practice.
        </p>

        {!concepts.length ? (
          <div className="mt-8 rounded-3xl border border-dashed border-ink/20 bg-white/70 p-8 text-center">
            <p className="text-lg font-semibold">Nothing here yet</p>
            <p className="mt-1 text-muted">Ask Lumo a question in a video, practice a topic, or add a course.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <section className="space-y-5">
              {[...bySubject.entries()].map(([subject, list]) => (
                <div key={subject} className="rounded-3xl border border-ink/10 bg-white p-5">
                  <h2 className="text-lg font-semibold capitalize">{subject}</h2>
                  <ul className="mt-3 divide-y divide-line">
                    {list
                      .sort((a, b) => a.effective - b.effective)
                      .map((c) => {
                        const r = c.recall;
                        return (
                          <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2.5 text-sm sm:grid-cols-[1.2fr_1fr_auto]">
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-xs text-muted">
                                {c.mastery.attempts ? `${c.mastery.correct}/${c.mastery.attempts} practice correct · ` : ""}
                                {c.mastery.last_evidence_at ? `recall ${Math.round(r * 100)}%` : "not practiced"}
                              </p>
                            </div>
                            <div className="order-3 col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
                              <div className="h-2 flex-1 rounded-full bg-ink/10">
                                <div className={`h-full rounded-full ${LEVEL_COLOR[c.level]}`} style={{ width: `${Math.max(4, Math.round(c.effective * 100))}%` }} />
                              </div>
                              <span className="w-20 text-xs capitalize text-muted">{c.level}</span>
                            </div>
                            <Link href={`/practice?concept=${c.id}`} className="text-xs font-medium text-pen">
                              Practice
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </section>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-ink/10 bg-white p-5">
                <h2 className="text-lg font-semibold">Mistakes you tend to make</h2>
                {!active.length ? (
                  <p className="mt-2 text-sm text-muted">None active right now.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {active.map((m) => (
                      <li key={m.id} className="rounded-xl bg-amber-50 px-3 py-2">
                        {m.concept_id && <span className="font-medium">{names.get(m.concept_id)}: </span>}
                        {m.description}
                        <span className="block text-xs text-muted">seen {m.occurrences}× · last {new Date(m.last_seen_at).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {resolved.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted">Fixed ({resolved.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {resolved.map((m) => (
                        <li key={m.id} className="text-ink/60 line-through decoration-green-600">
                          {m.description}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              <section className="rounded-3xl border border-ink/10 bg-white p-5">
                <h2 className="text-lg font-semibold">Explanations that work for you</h2>
                {!modalities?.length ? (
                  <p className="mt-2 text-sm text-muted">Lumo learns this by noticing which explanations lead to you getting the next question right.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {modalities.map((m) => (
                      <li key={m.modality}>
                        <div className="flex justify-between">
                          <span className="capitalize">{m.modality}</span>
                          <span className="text-xs text-muted">
                            {m.worked}/{m.shown} landed
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-ink/10">
                          <div className="h-full rounded-full bg-pen" style={{ width: `${m.shown ? Math.round((m.worked / m.shown) * 100) : 0}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-3xl border border-ink/10 bg-white p-5">
                <h2 className="text-lg font-semibold">Recent learning</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {(events ?? []).map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span>
                        You {EVENT_LABEL[e.kind] ?? e.kind} <span className="font-medium">{e.concept_id ? names.get(e.concept_id) : "a topic"}</span>
                        {e.kind === "attempt" && (e.correct ? " ✓" : " ✗")}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{new Date(e.created_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
