"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanDay } from "@/lib/courses/plan";
import { formatTime } from "@/lib/youtube";

type Material = { id: string; kind: string; title: string; status: string; error: string | null; video_id: string | null };
type Concept = {
  id: string;
  name: string;
  description: string | null;
  level: string;
  effective: number;
  examWeight: number;
  unitId: string | null;
  prerequisites: string[];
  videoMoments: { sessionId: string; seconds: number }[];
};

const LEVEL_STYLE: Record<string, string> = {
  new: "bg-stone-100 text-stone-700",
  shaky: "bg-red-100 text-red-900",
  developing: "bg-amber-100 text-amber-900",
  solid: "bg-sky-100 text-sky-900",
  mastered: "bg-green-100 text-green-900",
};

const KINDS = [
  ["syllabus", "Syllabus"],
  ["slides", "Slides (PDF)"],
  ["notes", "Notes"],
  ["textbook", "Textbook pages"],
  ["homework", "Homework"],
  ["exam", "Practice exam"],
  ["other", "Other"],
] as const;

export function CourseView({
  course,
  materials,
  units,
  concepts,
  plan,
  userId,
}: {
  course: { id: string; title: string; subject: string | null; exam_date: string | null };
  materials: Material[];
  units: { id: string; title: string; summary: string | null }[];
  concepts: Concept[];
  plan: { daysLeft: number | null; days: PlanDay[]; focus: { conceptId: string; name: string; reason: string }[] };
  userId: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState("syllabus");
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [examDate, setExamDate] = useState(course.exam_date ?? "");
  const [openConcept, setOpenConcept] = useState<string | null>(null);

  const working = materials.some((m) => m.status === "pending" || m.status === "processing");
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [working, router]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${userId}/${course.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await createClient().storage.from("materials").upload(path, file, { contentType: file.type });
    if (uploadError) {
      setUploading(false);
      return setError(uploadError.message);
    }
    const res = await fetch(`/api/courses/${course.id}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath: path, kind, title: file.name, mimeType: file.type || (file.name.endsWith(".md") ? "text/markdown" : "") }),
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) return setError(data.error);
    router.refresh();
  }

  async function addVideo() {
    setError(null);
    const res = await fetch(`/api/courses/${course.id}/videos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: videoUrl }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setVideoUrl("");
    router.refresh();
  }

  async function saveExamDate(value: string) {
    setExamDate(value);
    await fetch(`/api/courses/${course.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ examDate: value || null }) });
    router.refresh();
  }

  const byUnit = new Map<string | null, Concept[]>();
  for (const c of concepts) byUnit.set(c.unitId, [...(byUnit.get(c.unitId) ?? []), c]);
  const nameOf = new Map(concepts.map((c) => [c.id, c.name]));
  const today = plan.days[0];

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <header className="flex items-center justify-between">
          <Link href="/courses" className="text-lg font-semibold tracking-tight">
            ← Courses
          </Link>
        </header>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{course.title}</h1>
            <p className="text-muted">{course.subject ?? "Add material and Lumo will figure out the subject"}</p>
          </div>
          <label className="rounded-2xl border border-ink/10 bg-white px-4 py-2 text-sm">
            <span className="block text-xs text-muted">Next exam</span>
            <input type="date" value={examDate} onChange={(e) => saveExamDate(e.target.value)} className="font-semibold outline-none" />
            {plan.daysLeft !== null && <span className={`ml-2 font-medium ${plan.daysLeft <= 7 ? "text-pen" : "text-muted"}`}>{plan.daysLeft} days</span>}
          </label>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Study plan + course map */}
          <div className="space-y-5">
            <section className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[5px_5px_0_#1c1b19]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">{plan.daysLeft !== null ? `Your plan for the next ${plan.daysLeft} days` : "What to study next"}</h2>
                {today?.items[0] && (
                  <Link href={`/practice?concept=${today.items[0].conceptId}&course=${course.id}`} className="rounded-full bg-pen px-4 py-1.5 text-sm font-medium text-white">
                    Start today&apos;s plan →
                  </Link>
                )}
              </div>
              {!concepts.length ? (
                <p className="mt-3 text-muted">Add a syllabus, slides or a lecture video. Lumo will map the course and build your plan from what you know.</p>
              ) : (
                <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                  {plan.days.map((d) => (
                    <li key={d.date + d.label} className="rounded-2xl border border-ink/10 bg-stone-50/60 p-3">
                      <p className="text-sm font-semibold">
                        {d.label} <span className="font-normal text-muted">· {d.items.reduce((n, i) => n + i.minutes, 0)} min</span>
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {d.items.map((i) => (
                          <li key={i.conceptId} className="flex items-start justify-between gap-2 text-sm">
                            <Link href={`/practice?concept=${i.conceptId}&course=${course.id}`} className="hover:underline">
                              {i.name}
                              <span className="block text-xs text-muted">{i.reason}</span>
                            </Link>
                            <span className="shrink-0 text-xs text-muted">{i.minutes}m</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <h2 className="text-xl font-semibold">Course map</h2>
              <p className="text-sm text-muted">Every concept, what it depends on, where it&apos;s taught, and how well you know it.</p>
              <div className="mt-4 space-y-5">
                {[...units.map((u) => ({ id: u.id as string | null, title: u.title })), { id: null, title: "Other concepts" }]
                  .filter((u) => byUnit.get(u.id)?.length)
                  .map((u) => (
                    <div key={u.id ?? "none"}>
                      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{u.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {byUnit.get(u.id)!.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setOpenConcept(openConcept === c.id ? null : c.id)}
                            className={`rounded-full px-3 py-1 text-sm font-medium ${LEVEL_STYLE[c.level]} ${openConcept === c.id ? "ring-2 ring-ink" : ""}`}
                            title={c.description ?? ""}
                          >
                            {c.name}
                            {c.examWeight >= 2 && <span className="ml-1" title="Heavily tested">★</span>}
                          </button>
                        ))}
                      </div>
                      {byUnit.get(u.id)!.some((c) => c.id === openConcept) &&
                        (() => {
                          const c = concepts.find((x) => x.id === openConcept)!;
                          return (
                            <div className="mt-3 rounded-2xl border border-ink/10 bg-stone-50 p-4 text-sm">
                              <p className="font-semibold">
                                {c.name} · <span className="capitalize">{c.level}</span> ({Math.round(c.effective * 100)}%)
                              </p>
                              {c.description && <p className="mt-1 text-ink/75">{c.description}</p>}
                              {c.prerequisites.length > 0 && (
                                <p className="mt-2 text-ink/75">
                                  <span className="font-medium">Builds on: </span>
                                  {c.prerequisites.map((p) => nameOf.get(p) ?? "…").join(", ")}
                                </p>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link href={`/practice?concept=${c.id}&course=${course.id}`} className="rounded-full bg-ink px-3 py-1 text-white">
                                  Practice
                                </Link>
                                {c.videoMoments.slice(0, 3).map((m) => (
                                  <Link key={`${m.sessionId}-${m.seconds}`} href={`/watch/${m.sessionId}?t=${m.seconds}`} className="rounded-full border border-ink/15 bg-white px-3 py-1">
                                    ▶ Watch at {formatTime(m.seconds)}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
                {Object.entries(LEVEL_STYLE).map(([level, style]) => (
                  <span key={level} className={`rounded-full px-2 py-0.5 capitalize ${style}`}>
                    {level}
                  </span>
                ))}
                <span>★ heavily tested</span>
              </div>
            </section>
          </div>

          {/* Materials */}
          <aside className="space-y-5">
            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <h2 className="text-lg font-semibold">Add material</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm">
                  {KINDS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-white ${uploading ? "bg-ink/50" : "bg-ink"}`}>
                  {uploading ? "Uploading…" : "Choose file"}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted">PDF, images or text, up to 18 MB. Export slides to PDF first.</p>

              <div className="mt-4 flex gap-2">
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Lecture video link"
                  className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
                <button onClick={addVideo} disabled={!videoUrl.trim()} className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium disabled:opacity-40">
                  Add video
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <h2 className="text-lg font-semibold">Materials</h2>
              <ul className="mt-3 divide-y divide-line">
                {!materials.length && <li className="py-2 text-sm text-muted">Nothing added yet.</li>}
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.title}</p>
                      <p className="text-xs capitalize text-muted">{m.kind}</p>
                      {m.status === "failed" && m.error && <p className="text-xs text-red-600">{m.error}</p>}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        m.status === "ready" ? "bg-green-100 text-green-900" : m.status === "failed" ? "bg-red-100 text-red-900" : "animate-pulse bg-amber-100 text-amber-900"
                      }`}
                    >
                      {m.status === "ready" ? "mapped" : m.status === "failed" ? "failed" : "reading…"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <Link href="/board" className="block rounded-3xl border border-ink/10 bg-[#dfe8ff] p-5 hover:border-ink/30">
              <p className="font-semibold">Work through a problem with Lumo →</p>
              <p className="mt-1 text-sm text-ink/70">Open the whiteboard and ask about anything in this course.</p>
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
