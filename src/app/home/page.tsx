import Link from "next/link";
import { redirect } from "next/navigation";
import { AddVideoForm } from "@/components/add-video-form";
import { AppNav } from "@/components/app-nav";
import { InviteFriends } from "@/components/invite-friends";
import { PlanUsage } from "@/components/plan-usage";
import { syncSubscriptionFromStripe } from "@/lib/billing";
import { effectivePlan } from "@/lib/entitlements";
import { dueReviews } from "@/lib/brain/review";
import { listConceptsWithMastery } from "@/lib/brain/store";
import { createClient } from "@/lib/supabase/server";
import { usageSummary } from "@/lib/usage";
import { formatTime } from "@/lib/youtube";

export const metadata = { title: "Home" };

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const { upgraded } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/home");

  const [concepts, { data: profile }, { data: sessions }, { data: courses }, { data: misconceptions }] = await Promise.all([
    listConceptsWithMastery(user.id).catch(() => []),
    supabase.from("profiles").select("name, plan, plus_trial_until, stripe_customer_id").eq("id", user.id).maybeSingle(),
    supabase
      .from("sessions")
      .select("id, last_position, video_id, videos(title, duration_seconds, thumbnail_url, provider)")
      .not("video_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase.from("courses").select("id, title, exam_date").order("exam_date", { ascending: true, nullsFirst: false }).limit(4),
    supabase.from("misconceptions").select("id, description, occurrences, concept_id").is("resolved_at", null).order("occurrences", { ascending: false }).limit(3),
  ]);

  let plan = effectivePlan(profile);
  // Back from checkout: confirm with Stripe directly instead of waiting for the webhook.
  if (upgraded && profile?.stripe_customer_id && plan === "free") {
    await syncSubscriptionFromStripe(user.id, profile.stripe_customer_id).catch((err) => console.error("subscription sync failed", err));
    const { data: fresh } = await supabase.from("profiles").select("plan, plus_trial_until").eq("id", user.id).maybeSingle();
    plan = effectivePlan(fresh);
  }
  const meters = await usageSummary(user.id, plan);
  const reviews = dueReviews(concepts);
  const weak = concepts.filter((c) => c.level === "shaky").sort((a, b) => b.exam_weight - a.exam_weight).slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile?.name?.split(" ")[0];
  const today = new Date().toISOString().slice(0, 10);
  const upcomingExam = courses?.find((c) => c.exam_date && c.exam_date >= today);
  const daysToExam = upcomingExam ? Math.round((new Date(upcomingExam.exam_date!).getTime() - new Date(today).getTime()) / 86_400_000) : null;
  const conceptName = new Map(concepts.map((c) => [c.id, c.name]));

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <AppNav current="/home" />

        {upgraded && (
          <p className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {plan !== "free" ? `Welcome to LumoTutor ${plan === "pro" ? "Pro" : "Plus"}! Everything is unlocked.` : "Payment received. Your plan will activate in a few seconds; refresh if it doesn't."}
          </p>
        )}
        <section className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2 text-lg text-ink/70">
            {upcomingExam && daysToExam !== null && daysToExam <= 14
              ? `${upcomingExam.title} exam in ${daysToExam} day${daysToExam === 1 ? "" : "s"}. Your plan is ready.`
              : reviews.length
                ? reviews[0].message
                : concepts.length
                  ? "Pick up where you left off, or learn something new."
                  : "Paste a lecture, start a course, or open the whiteboard. Lumo learns how you learn as you go."}
          </p>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            {reviews.length > 0 && (
              <section className="rounded-3xl border-2 border-ink bg-[#dfe8ff] p-5 shadow-[5px_5px_0_#1c1b19]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold">Quick review</h2>
                  <Link href="/practice?review=1" className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white">
                    Start ({Math.min(reviews.length, 5)} min) →
                  </Link>
                </div>
                <p className="mt-1 text-sm text-ink/70">Remembering right before you&apos;d forget makes it stick far longer.</p>
                <ul className="mt-3 space-y-2">
                  {reviews.slice(0, 4).map((r) => (
                    <li key={r.concept.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm">
                      <span>{r.message}</span>
                      <span className="shrink-0 text-xs text-muted">{Math.round(r.recall * 100)}% recall</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <h2 className="text-xl font-semibold">Keep watching</h2>
              <div className="mt-3">
                <AddVideoForm />
              </div>
              {sessions?.length ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {sessions.map((s) => {
                    const v = s.videos as unknown as { title: string | null; duration_seconds: number | null; thumbnail_url: string | null; provider: string };
                    const thumb = v.thumbnail_url ?? (v.provider === "youtube" ? `https://i.ytimg.com/vi/${s.video_id}/mqdefault.jpg` : null);
                    return (
                      <li key={s.id}>
                        <Link href={`/watch/${s.id}`} className="block overflow-hidden rounded-xl border border-ink/10 hover:border-ink/30">
                          <div className="aspect-video bg-stone-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <p className="line-clamp-2 px-2.5 pt-2 text-sm font-medium">{v.title ?? "Video"}</p>
                          <p className="px-2.5 pb-2 text-xs text-muted">resume at {formatTime(s.last_position)}</p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/board" className="rounded-3xl border border-ink/10 bg-[#fff1b8] p-5 hover:border-ink/30">
                <p className="text-lg font-semibold">Whiteboard →</p>
                <p className="mt-1 text-sm text-ink/70">Work through any problem with Lumo. Draw your attempt and get feedback.</p>
              </Link>
              <Link href="/practice" className="rounded-3xl border border-ink/10 bg-[#ffe1d2] p-5 hover:border-ink/30">
                <p className="text-lg font-semibold">Practice →</p>
                <p className="mt-1 text-sm text-ink/70">Problems chosen for exactly where you are, with hints and diagnosis.</p>
              </Link>
              <Link href="/homework" className="rounded-3xl border border-ink/10 bg-[#d8f3dc] p-5 hover:border-ink/30 sm:col-span-2">
                <p className="text-lg font-semibold">Homework →</p>
                <p className="mt-1 text-sm text-ink/70">Drop in a problem set, write on the page, and work through it with Lumo watching your steps.</p>
              </Link>
            </div>
          </div>

          <aside className="space-y-5">
            <PlanUsage plan={plan} meters={meters} trialUntil={plan === "plus" && profile?.plan !== "plus" ? profile?.plus_trial_until : null} />
            {plan === "free" || (profile?.plan !== "plus" && profile?.plan !== "pro") ? <InviteFriends compact /> : null}
            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Courses</h2>
                <Link href="/courses" className="text-sm text-muted hover:text-ink">
                  All →
                </Link>
              </div>
              {courses?.length ? (
                <ul className="mt-3 space-y-2">
                  {courses.map((c) => {
                    const days = c.exam_date && c.exam_date >= today ? Math.round((new Date(c.exam_date).getTime() - new Date(today).getTime()) / 86_400_000) : null;
                    return (
                      <li key={c.id}>
                        <Link href={`/courses/${c.id}`} className="flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-stone-50">
                          <span className="font-medium">{c.title}</span>
                          {days !== null && <span className={`text-xs ${days <= 7 ? "font-semibold text-pen" : "text-muted"}`}>exam in {days}d</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Link href="/courses" className="mt-2 block text-sm text-muted hover:text-ink">
                  Add your first course: upload the syllabus and Lumo plans your semester →
                </Link>
              )}
            </section>

            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Needs attention</h2>
                <Link href="/brain" className="text-sm text-muted hover:text-ink">
                  Lumo Brain →
                </Link>
              </div>
              {!weak.length && !misconceptions?.length ? (
                <p className="mt-2 text-sm text-muted">Nothing flagged yet. As you ask questions and practice, Lumo tracks what you&apos;ve got and what needs work.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {misconceptions?.map((m) => (
                    <li key={m.id} className="rounded-xl bg-amber-50 px-3 py-2">
                      <span className="font-medium">{m.concept_id ? conceptName.get(m.concept_id) : "Misconception"}: </span>
                      {m.description}
                      {m.occurrences > 1 && <span className="text-xs text-muted"> · seen {m.occurrences}×</span>}
                    </li>
                  ))}
                  {weak.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 hover:bg-stone-50">
                      <span>{c.name}</span>
                      <Link href={`/practice?concept=${c.id}`} className="text-xs font-medium text-pen">
                        Practice →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
