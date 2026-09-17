import Link from "next/link";
import { AddVideoForm } from "@/components/add-video-form";
import { ManageBillingButton } from "@/components/billing-buttons";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/youtube";

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const { upgraded } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("plan, stripe_customer_id").eq("id", user!.id).maybeSingle();
  const isPro = profile?.plan === "pro";
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, last_position, updated_at, video_id, videos(title, channel, duration_seconds, provider, thumbnail_url), messages(count)")
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="text-xl font-semibold tracking-tight">LumoTutor</span>
        <div className="flex items-center gap-4 text-sm">
          {isPro ? (
            <span className="rounded-full bg-[#fff1b8] px-3 py-1 font-semibold">Pro</span>
          ) : (
            <Link href="/pricing" className="rounded-full bg-ink px-3 py-1.5 font-medium text-white hover:bg-ink/85">
              Upgrade
            </Link>
          )}
          {profile?.stripe_customer_id && <ManageBillingButton className="text-muted hover:text-foreground" />}
          <SignOutButton />
        </div>
      </header>

      {upgraded && (
        <p className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {isPro ? "You're on Pro. Thanks for supporting LumoTutor!" : "Payment received. Your Pro plan will activate in a few seconds; refresh if it doesn't."}
        </p>
      )}

      <div className="mt-8">
        <AddVideoForm />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Your videos</h2>
      {!sessions?.length ? (
        <p className="mt-4 text-muted">Nothing yet — paste a link above to get started.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => {
            const video = s.videos as unknown as {
              title: string | null;
              channel: string | null;
              duration_seconds: number | null;
              provider: string;
              thumbnail_url: string | null;
            };
            const thumbnail = video.thumbnail_url ?? (video.provider === "youtube" ? `https://i.ytimg.com/vi/${s.video_id}/mqdefault.jpg` : null);
            const questions = (s.messages as unknown as { count: number }[])[0]?.count ?? 0;
            const progress = video.duration_seconds ? Math.min(1, s.last_position / video.duration_seconds) : 0;
            return (
              <li key={s.id}>
                <Link href={`/watch/${s.id}`} className="group block overflow-hidden rounded-xl border border-line bg-white">
                  <div className="relative aspect-video bg-stone-200">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnail} alt="" className="h-full w-full object-cover transition group-hover:opacity-90" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl text-ink/30">▶</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                      <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium">{video.title ?? "Untitled video"}</p>
                    <p className="mt-1 text-xs text-muted">
                      {video.channel} · {Math.floor(questions / 2)} questions · resume at {formatTime(s.last_position)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
