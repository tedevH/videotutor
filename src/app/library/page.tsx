import Link from "next/link";
import { AddVideoForm } from "@/components/add-video-form";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/youtube";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, last_position, updated_at, video_id, videos(title, channel, duration_seconds), messages(count)")
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="font-hand text-3xl">VideoTutor</span>
        <SignOutButton />
      </header>

      <div className="mt-8">
        <AddVideoForm />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">Your videos</h2>
      {!sessions?.length ? (
        <p className="mt-4 text-muted">Nothing yet — paste a link above to get started.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => {
            const video = s.videos as unknown as { title: string | null; channel: string | null; duration_seconds: number | null };
            const questions = (s.messages as unknown as { count: number }[])[0]?.count ?? 0;
            const progress = video.duration_seconds ? Math.min(1, s.last_position / video.duration_seconds) : 0;
            return (
              <li key={s.id}>
                <Link href={`/watch/${s.id}`} className="group block overflow-hidden rounded-xl border border-line bg-white">
                  <div className="relative aspect-video bg-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${s.video_id}/mqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:opacity-90"
                    />
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
