import Link from "next/link";
import { redirect } from "next/navigation";
import { listConceptsWithMastery } from "@/lib/brain/store";
import { createClient } from "@/lib/supabase/server";
import { NewCourseForm } from "./new-course-form";

export const metadata = { title: "Courses · LumoTutor" };

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/courses");

  const [{ data: courses }, concepts] = await Promise.all([
    supabase.from("courses").select("id, title, subject, exam_date").order("updated_at", { ascending: false }),
    listConceptsWithMastery(user.id).catch(() => []),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <header className="flex items-center justify-between">
          <Link href="/home" className="text-lg font-semibold tracking-tight">
            ← LumoTutor
          </Link>
        </header>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Your courses</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          Add a syllabus, slides, notes, homework, past exams and lecture videos. Lumo builds the course map, tracks what you&apos;ve mastered, and plans what to study before the exam.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <ul className="grid gap-3">
            {!courses?.length && <li className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-6 text-muted">No courses yet. Create one to get started.</li>}
            {courses?.map((c) => {
              const mine = concepts.filter((k) => k.course_id === c.id);
              const mastered = mine.filter((k) => k.level === "solid" || k.level === "mastered").length;
              const pct = mine.length ? Math.round((mastered / mine.length) * 100) : 0;
              const days = c.exam_date && c.exam_date >= today ? Math.round((new Date(c.exam_date).getTime() - new Date(today).getTime()) / 86_400_000) : null;
              return (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}`} className="block rounded-2xl border border-ink/10 bg-white p-5 hover:border-ink/30">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-lg font-semibold">{c.title}</p>
                      {days !== null && <span className={`text-sm font-medium ${days <= 7 ? "text-pen" : "text-muted"}`}>exam in {days} day{days === 1 ? "" : "s"}</span>}
                    </div>
                    <p className="text-sm text-muted">{c.subject ?? "Subject not set"} · {mine.length} concepts</p>
                    <div className="mt-3 h-2 rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-pen" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{pct}% solid or mastered</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          <NewCourseForm />
        </div>
      </div>
    </main>
  );
}
