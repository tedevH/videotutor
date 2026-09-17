import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddVideoForm } from "@/components/add-video-form";
import { DemoVideo } from "@/components/landing/demo-video";
import { StaticDiagrams } from "@/components/landing/static-diagrams";
import { createClient } from "@/lib/supabase/server";

const UNIVERSITIES = ["Stanford", "UC Berkeley", "Cornell", "Emory", "UC Davis", "MIT", "UCLA", "Harvard", "Yale", "Georgia Tech"];

/** Logos are opt-in: drop an approved file at public/logos/<slug>.svg (or .png) and it replaces the name. */
function universityLogo(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  for (const ext of ["svg", "png"]) {
    if (existsSync(join(process.cwd(), "public", "logos", `${slug}.${ext}`))) return `/logos/${slug}.${ext}`;
  }
  return null;
}

const SUBJECTS = [
  { name: "Calculus", ask: "why does the chain rule multiply?" },
  { name: "Organic chemistry", ask: "where does the arrow push from?" },
  { name: "Physics", ask: "why is normal force not mg here?" },
  { name: "Biology", ask: "which phase does the DNA copy in?" },
  { name: "Statistics", ask: "what is a p-value actually saying?" },
  { name: "Computer science", ask: "why is this loop O(n log n)?" },
  { name: "Economics", ask: "why does the curve shift left?" },
  { name: "Linear algebra", ask: "what does the determinant measure?" },
  { name: "Psychology", ask: "how is this different from conditioning?" },
  { name: "History", ask: "how did that treaty lead to the war?" },
  { name: "Accounting", ask: "why is this a debit?" },
  { name: "Music theory", ask: "why does that chord resolve there?" },
];

const FAQS = [
  {
    q: "What videos does it work with?",
    a: "Any public YouTube video: university lectures, AP review, Khan-style explainers, conference talks, coding tutorials. Paste the link and start watching.",
  },
  {
    q: "How does the tutor know what's on screen?",
    a: "The first time anyone adds a video, we take notes on what's said and shown throughout it. When you ask, the tutor also watches the 30 seconds right before your pause, so it knows the exact graph, equation or diagram you're looking at.",
  },
  {
    q: "What does \"exact diagrams\" do?",
    a: "If you allow it, the app captures the single frame you paused on and the tutor draws directly on it: circling the term, pointing at the curve, labeling the strip. Nothing is recorded while you watch. You can turn it off with one click.",
  },
  {
    q: "Which subjects does it cover?",
    a: "All of them. Math and science get graphs and annotated frames, processes get flowcharts, and essay-style subjects like history or psychology get clear written explanations tied to the moment in the lecture.",
  },
  {
    q: "Does the video pause by itself?",
    a: "Only when you start typing a question. The moment your first key goes down, the video stops and your question is pinned to that timestamp. Hit Resume or press space to keep going.",
  },
  {
    q: "Can the tutor be wrong?",
    a: "Yes, like any AI it can make mistakes. Every answer links back to the exact moment in the video so you can check it, and you can flag answers that miss.",
  },
  {
    q: "Is it free?",
    a: "Yes, during early access, with a daily question limit. Your questions and diagrams are saved to your account so you can review them before exams.",
  },
  {
    q: "Who can see my questions?",
    a: "Only you. Questions, answers and captured frames are private to your account.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/library");

  return (
    <main className="graph-paper flex flex-1 flex-col overflow-x-clip text-ink">
      {/* nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          VideoTutor
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how" className="hidden hover:underline sm:inline">
            How it works
          </a>
          <a href="#subjects" className="hidden hover:underline sm:inline">
            Subjects
          </a>
          <a href="#faq" className="hidden hover:underline sm:inline">
            FAQ
          </a>
          <Link href="/login" className="rounded-full bg-ink px-4 py-2 font-medium text-white hover:bg-ink/85">
            Sign in
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-14">
        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-sm font-medium text-pen">For the moment a lecture loses you</p>
            <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[64px]">
              Pause the lecture.
              <br />
              Ask the part you <span className="marker">missed</span>.
            </h1>
          </div>
          <div className="lg:pb-3">
            <p className="text-lg leading-relaxed text-ink/80">
              Paste any YouTube lesson. When something doesn&apos;t click, start typing. The video stops, and a tutor that watched the same
              minute you did explains it, drawing right on the frame you&apos;re stuck on.
            </p>
            <div className="mt-6">
              <AddVideoForm signedIn={false} />
            </div>
            <p className="mt-2 text-sm text-muted">Free during early access. Works for every subject.</p>
          </div>
        </div>
      </section>

      {/* demo */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-label="Product demo">
        <DemoVideo />
      </section>

      {/* universities */}
      <section className="mx-auto mt-20 w-full max-w-6xl px-4 sm:px-6">
        <p className="text-center text-sm text-muted">Used by students from</p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {UNIVERSITIES.map((u) => {
            const logo = universityLogo(u);
            return (
              <li key={u} className="flex h-10 items-center text-lg font-semibold text-ink/55">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={u} className="h-9 w-auto opacity-70 grayscale" />
                ) : (
                  u
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-10 px-4 sm:px-6">
        <h2 className="max-w-2xl text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">Office hours, at the exact second you need them.</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {[
            {
              n: "1",
              title: "Paste a link",
              body: "Any lecture or explainer. We take notes on the whole video once, what's said and what's on the board.",
            },
            {
              n: "2",
              title: "Start typing",
              body: "Your first keystroke freezes the video and pins your question to that timestamp. No rewinding, no retyping context.",
            },
            {
              n: "3",
              title: "See it explained",
              body: "A short answer in plain language, plus a visual when it helps: the real frame annotated, a graph, or a step-by-step sketch.",
            },
          ].map((s) => (
            <li key={s.n} className="border-t-2 border-ink pt-4">
              <span className="text-sm font-semibold text-pen">Step {s.n}</span>
              <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink/75">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* static diagrams */}
      <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-xl text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">
            It draws what the professor meant.
          </h2>
          <p className="max-w-sm text-ink/75">Two real kinds of questions, answered the way a good TA would sketch them on a napkin.</p>
        </div>
        <div className="mt-10">
          <StaticDiagrams />
        </div>
      </section>

      {/* subjects */}
      <section id="subjects" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-10 px-4 sm:px-6">
        <h2 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">Every subject. Every lecture.</h2>
        <p className="mt-3 max-w-xl text-ink/75">If it&apos;s taught on video, you can stop and ask about it.</p>
        <ul className="mt-10 grid grid-cols-1 border-l border-t border-ink/15 sm:grid-cols-2 lg:grid-cols-4">
          {SUBJECTS.map((s) => (
            <li key={s.name} className="border-b border-r border-ink/15 bg-paper/60 p-5">
              <p className="font-semibold">{s.name}</p>
              <p className="mt-2 text-[15px] leading-snug text-ink/65">&ldquo;{s.ask}&rdquo;</p>
            </li>
          ))}
        </ul>
      </section>

      {/* students */}
      <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-ink/10 bg-white px-6 py-12 sm:px-12 sm:py-16">
          <h2 className="max-w-2xl text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">Built for students who learn from video.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                who: "High school",
                body: "AP Calc, AP Bio, AP Chem and SAT review videos. Ask the question you'd feel awkward raising in class.",
              },
              {
                who: "College",
                body: "Recorded lectures, problem-set walkthroughs, and the 2 a.m. study session when office hours are long over.",
              },
              {
                who: "Exam season",
                body: "Every question you ask is saved with its timestamp and diagram, so your confusions turn into a review sheet.",
              },
            ].map((c) => (
              <div key={c.who}>
                <p className="text-lg font-semibold text-pen">{c.who}</p>
                <p className="mt-2 leading-relaxed text-ink/75">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto mt-28 grid w-full max-w-6xl scroll-mt-10 gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">Questions</h2>
          <p className="mt-3 text-ink/75">
            Fitting, really. Still curious? Paste a lecture and ask the tutor.
          </p>
        </div>
        <div className="border-t border-ink/20">
          {FAQS.map((f) => (
            <details key={f.q} className="faq group border-b border-ink/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium">
                {f.q}
                <span className="faq-plus shrink-0 text-2xl leading-none text-pen transition-transform">+</span>
              </summary>
              <p className="-mt-1 pb-5 pr-10 leading-relaxed text-ink/75">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* closing */}
      <section className="mx-auto mt-28 w-full max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">
          Next time you&apos;re lost, just ask.
        </h2>
        <div className="mx-auto mt-8 max-w-xl text-left">
          <AddVideoForm signedIn={false} />
        </div>
      </section>

      <footer className="mx-auto mt-24 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-4 py-8 text-sm text-muted sm:px-6">
        <span className="font-semibold text-ink">VideoTutor</span>
        <span>© 2026 VideoTutor</span>
      </footer>
    </main>
  );
}
