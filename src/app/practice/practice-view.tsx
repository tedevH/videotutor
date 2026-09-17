"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MarkdownBlock } from "@/components/blocks/markdown-block";
import type { GradeResult } from "@/lib/practice/schema";

type Item = {
  id: string;
  concept_id: string;
  concept: string;
  difficulty: "easy" | "medium" | "hard" | "transfer";
  kind: string;
  prompt: string;
  choices: string[] | null;
  hints_available: number;
  targets_misconception: boolean;
};

type Feedback = {
  grade: GradeResult;
  solution: { answer: string; steps: string[] } | null;
  mastery: { before: number; after: number; level: string };
};

const DIFFICULTY_STYLE: Record<Item["difficulty"], string> = {
  easy: "bg-green-100 text-green-900",
  medium: "bg-sky-100 text-sky-900",
  hard: "bg-orange-100 text-orange-900",
  transfer: "bg-purple-100 text-purple-900",
};
const DIFFICULTY_NOTE: Record<Item["difficulty"], string> = {
  easy: "Warm-up to lock in the core idea",
  medium: "Standard exam-style problem",
  hard: "Combines ideas; this is where A students separate",
  transfer: "Same idea, new situation: first figure out what applies",
};

export function PracticeView({
  initialConceptId,
  courseId,
  initialTopic,
  suggestions,
}: {
  initialConceptId: string | null;
  courseId: string | null;
  initialTopic: string;
  suggestions: { id: string; name: string; subject: string | null; level: string }[];
}) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState(initialTopic);
  const [answer, setAnswer] = useState("");
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [solution, setSolution] = useState<{ answer: string; steps: string[] } | null>(null);
  const [streak, setStreak] = useState(0);

  const loadNext = useCallback(
    async (target: { conceptId?: string | null; topic?: string }) => {
      setLoading(true);
      setError(null);
      setFeedback(null);
      setHints([]);
      setSolution(null);
      setAnswer("");
      const res = await fetch("/api/practice/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId: target.conceptId ?? undefined, topic: target.topic, courseId: courseId ?? undefined }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) return setError(data.error ?? "Couldn't load a problem");
      setItem(data.item);
    },
    [courseId],
  );

  useEffect(() => {
    // Deep links (from a course or the brain page) start immediately.
    if (!initialConceptId && !initialTopic && !courseId) return;
    const t = setTimeout(() => void loadNext({ conceptId: initialConceptId, topic: initialTopic || undefined }), 0);
    return () => clearTimeout(t);
  }, [initialConceptId, initialTopic, courseId, loadNext]);

  async function check(value = answer) {
    if (!item || !value.trim()) return;
    setChecking(true);
    setError(null);
    const res = await fetch(`/api/practice/${item.id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: value }),
    });
    const data = await res.json();
    setChecking(false);
    if (!res.ok) return setError(data.error ?? "Couldn't check that");
    setFeedback(data);
    setStreak((s) => (data.grade.result === "correct" ? s + 1 : 0));
  }

  async function hint() {
    if (!item) return;
    const res = await fetch(`/api/practice/${item.id}/hint`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setHints(data.hints);
  }

  async function reveal() {
    if (!item) return;
    const res = await fetch(`/api/practice/${item.id}/solution`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setSolution({ answer: data.answer, steps: data.steps });
  }

  const solved = feedback?.grade.result === "correct";

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/home" className="text-lg font-semibold tracking-tight">
          ← LumoTutor
        </Link>
        {streak > 1 && <span className="rounded-full bg-[#fff1b8] px-3 py-1 text-sm font-semibold">🔥 {streak} in a row</span>}
      </header>

      <section className="mx-auto w-full max-w-3xl px-4 pb-24">
        {!item && !loading && (
          <div className="rounded-3xl border border-ink/10 bg-white p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
            <p className="mt-2 text-ink/70">Lumo picks the next problem based on what you know, what you keep missing, and what you&apos;re about to forget.</p>
            <form
              className="mt-6 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (topic.trim()) void loadNext({ topic });
              }}
            >
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to practice? e.g. chain rule, eigenvalues, SN2 reactions"
                className="min-w-0 flex-1 rounded-xl border border-ink/15 px-4 py-3 outline-none focus:border-ink/40"
              />
              <button className="rounded-xl bg-ink px-5 py-3 font-medium text-white">Start</button>
            </form>
            {suggestions.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold">Lumo suggests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadNext({ conceptId: s.id })}
                      className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm hover:border-ink/40"
                    >
                      {s.name} <span className="text-muted">· {s.level}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-ink/10 bg-white p-8 text-center text-muted">
            <p className="font-medium text-ink">Writing your next problem…</p>
            <p className="mt-1 text-sm">Lumo checks the answer key before showing it to you, which can take up to a minute.</p>
          </div>
        )}

        {item && !loading && (
          <article className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[6px_6px_0_#1c1b19] sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">{item.concept}</span>
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${DIFFICULTY_STYLE[item.difficulty]}`}>{item.difficulty}</span>
              {item.kind === "recognize" && <span className="rounded-full bg-stone-100 px-2.5 py-0.5">recognition</span>}
              {item.kind === "explain" && <span className="rounded-full bg-stone-100 px-2.5 py-0.5">explain it</span>}
              {item.targets_misconception && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900">targets a mistake you&apos;ve made</span>}
            </div>
            <p className="mt-1 text-xs text-muted">{DIFFICULTY_NOTE[item.difficulty]}</p>

            <div className="mt-5 text-lg">
              <MarkdownBlock md={item.prompt} className="text-[17px]" />
            </div>

            {item.choices ? (
              <div className="mt-5 grid gap-2">
                {item.choices.map((c, i) => (
                  <button
                    key={i}
                    disabled={checking || solved}
                    onClick={() => {
                      const value = `${String.fromCharCode(65 + i)}) ${c}`;
                      setAnswer(value);
                      void check(value);
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition ${answer.startsWith(String.fromCharCode(65 + i)) ? "border-ink bg-stone-50" : "border-ink/15 hover:border-ink/40"}`}
                  >
                    <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}</span>
                    <MarkdownBlock md={c} className="inline [&_p]:inline" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={solved}
                  rows={item.kind === "explain" || item.kind === "recognize" ? 4 : 2}
                  placeholder={item.kind === "compute" ? "Your answer (you can show work, e.g. x = 4 because…)" : "Explain in your own words"}
                  className="w-full resize-y rounded-xl border border-ink/15 px-4 py-3 outline-none focus:border-ink/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void check();
                  }}
                />
              </div>
            )}

            {hints.length > 0 && (
              <ol className="mt-4 space-y-2">
                {hints.map((h, i) => (
                  <li key={i} className="rounded-xl bg-sky-50 px-4 py-2 text-sm text-sky-950">
                    <span className="font-semibold">Hint {i + 1}: </span>
                    <MarkdownBlock md={h} className="inline text-sm [&_p]:inline" />
                  </li>
                ))}
              </ol>
            )}

            {feedback && (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 ${
                  solved ? "border-green-200 bg-green-50" : feedback.grade.result === "partial" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
                }`}
              >
                <p className="font-semibold">{solved ? "✓ Correct" : feedback.grade.result === "partial" ? "◐ Almost" : "✗ Not yet"}</p>
                <MarkdownBlock md={feedback.grade.feedback} className="text-[15px]" />
                {!solved && feedback.grade.diagnosis && (
                  <p className="mt-1 text-sm text-ink/70">
                    <span className="font-semibold">What likely happened: </span>
                    {feedback.grade.diagnosis}
                  </p>
                )}
                {!solved && feedback.grade.next_step_hint && (
                  <MarkdownBlock md={`**Try:** ${feedback.grade.next_step_hint}`} className="text-sm" />
                )}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted">
                    <span>{item.concept} mastery</span>
                    <span>
                      {feedback.mastery.before}% → <b className="text-ink">{feedback.mastery.after}%</b> · {feedback.mastery.level}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-pen transition-all duration-700" style={{ width: `${feedback.mastery.after}%` }} />
                  </div>
                </div>
              </div>
            )}

            {(solution || feedback?.solution) && (
              <div className="mt-4 rounded-2xl border border-ink/10 bg-stone-50 px-4 py-3">
                <p className="text-sm font-semibold">Solution</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-[15px]">
                  {(solution ?? feedback!.solution!).steps.map((s, i) => (
                    <li key={i}>
                      <MarkdownBlock md={s} className="text-[15px] [&_p]:my-0" />
                    </li>
                  ))}
                </ol>
                <MarkdownBlock md={`**Answer:** ${(solution ?? feedback!.solution!).answer}`} className="mt-2 text-[15px]" />
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {!solved && !solution && (
                <>
                  {!item.choices && (
                    <button onClick={() => check()} disabled={checking || !answer.trim()} className="rounded-xl bg-ink px-5 py-2.5 font-medium text-white disabled:opacity-40">
                      {checking ? "Checking…" : feedback ? "Check again" : "Check"}
                    </button>
                  )}
                  {hints.length < item.hints_available && (
                    <button onClick={hint} className="rounded-xl border border-ink/15 px-4 py-2.5 hover:bg-stone-50">
                      {hints.length ? "Another hint" : "Hint"}
                    </button>
                  )}
                  <button onClick={reveal} className="px-2 py-2.5 text-sm text-muted hover:text-ink">
                    Show solution
                  </button>
                </>
              )}
              {(solved || solution) && (
                <button onClick={() => loadNext({ conceptId: item.concept_id })} className="rounded-xl bg-ink px-5 py-2.5 font-medium text-white">
                  Next problem →
                </button>
              )}
              <span className="flex-1" />
              <button onClick={() => setItem(null)} className="text-sm text-muted hover:text-ink">
                Practice something else
              </button>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
