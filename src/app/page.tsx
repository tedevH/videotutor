import Link from "next/link";
import { redirect } from "next/navigation";
import { AddVideoForm } from "@/components/add-video-form";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/library");

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <span className="font-hand text-3xl">VideoTutor</span>
        <Link href="/login" className="text-sm font-medium hover:underline">
          Sign in
        </Link>
      </header>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Stuck on a video? <span className="font-hand text-6xl text-accent sm:text-7xl">Just ask.</span>
        </h1>
        <p className="mt-4 text-lg text-muted">
          Paste any YouTube lesson. Start typing when you&apos;re confused — the video pauses and your tutor explains it,
          drawing diagrams right from what you just watched.
        </p>
        <div className="mt-8 w-full">
          <AddVideoForm signedIn={false} />
        </div>
      </section>
    </main>
  );
}
