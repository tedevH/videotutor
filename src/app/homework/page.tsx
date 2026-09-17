import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { AssignmentDropzone } from "@/components/homework/assignment-dropzone";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Homework" };

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
  processing: "animate-pulse bg-amber-100 text-amber-900",
  pending: "animate-pulse bg-amber-100 text-amber-900",
};

export default async function HomeworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/homework");

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, kind, status, page_count, due_date, created_at, courses(title)")
    .order("created_at", { ascending: false });

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <AppNav current="/homework" />

        <section className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Homework</h1>
          <p className="mt-2 text-lg text-ink/70">Drop in a problem set and work through it on the page. Lumo reads what you write and helps you solve it yourself.</p>
        </section>

        <section className="mt-6 rounded-3xl border-2 border-ink bg-white p-5 shadow-[5px_5px_0_#1c1b19]">
          <AssignmentDropzone />
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Your assignments</h2>
          {!assignments?.length ? (
            <p className="mt-2 text-muted">Nothing uploaded yet. Your first problem set goes above.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {assignments.map((a) => {
                const course = a.courses as unknown as { title: string } | null;
                return (
                  <li key={a.id}>
                    <Link href={`/homework/${a.id}`} className="block rounded-2xl border border-ink/10 bg-white p-4 hover:border-ink/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{a.title}</p>
                          <p className="text-xs capitalize text-muted">
                            {a.kind} · {a.page_count} page{a.page_count === 1 ? "" : "s"}
                            {course ? ` · ${course.title}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[a.status] ?? STATUS_STYLE.pending}`}>
                          {a.status === "ready" ? "ready" : a.status === "failed" ? "failed" : "reading…"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
