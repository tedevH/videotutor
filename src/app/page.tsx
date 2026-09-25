import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddVideoForm } from "@/components/add-video-form";
import { PricingCards } from "@/components/pricing-cards";
import { DemoVideo } from "@/components/landing/demo-video";
import { SITE } from "@/lib/site";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { StaticDiagrams } from "@/components/landing/static-diagrams";
import { SubjectFlashcards } from "@/components/landing/subject-flashcards";
import { CollegeIllustration, ExamIllustration, HighSchoolIllustration } from "@/components/landing/student-illustrations";
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


const FAQS = [
  {
    q: "What videos does it work with?",
    a: "Public videos on YouTube and Vimeo, plus lecture video files hosted by universities (.edu) and the Internet Archive. Other sites are blocked for now to keep things safe. For Vimeo, turn on exact diagrams so the tutor can see what's playing.",
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
    a: "Yes. Free includes 2 lectures a month, 100 tutor questions and 40 practice problems. Plus ($9.99/month or $79.99/year) unlocks 25 hours of lectures, 600 questions a month, voice tutoring, diagrams, adaptive practice, memory and exam prep. Pro ($19.99/month) doubles that and uses the strongest models on hard problems. Invite 2 friends and you get 14 days of Plus free.",
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
  if (user) redirect("/home");

  return (
    <main className="graph-paper flex flex-1 flex-col overflow-x-clip text-ink">
      {/* nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          LumoTutor
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#features" className="hidden hover:underline sm:inline">
            Features
          </a>
          <a href="#subjects" className="hidden hover:underline sm:inline">
            Subjects
          </a>
          <a href="#faq" className="hidden hover:underline sm:inline">
            FAQ
          </a>
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
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
              Paste any lecture. When something doesn&apos;t click, start typing or just ask out loud. Lumo pauses the video, explains that exact moment with a diagram, checks you&apos;ve got it, and remembers what you struggle with all semester.
            </p>
            <div className="mt-6">
              <AddVideoForm signedIn={false} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href="/try" className="rounded-full border-2 border-ink bg-white px-5 py-2.5 font-medium shadow-[3px_3px_0_#1c1b19] hover:bg-stone-50">
                Or try it now, no account →
              </Link>
              <span className="text-sm text-muted">Ask about any problem. Nothing to sign up for.</span>
            </div>
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
        <ul className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {UNIVERSITIES.map((u) => {
            const logo = universityLogo(u);
            return (
              <li key={u} className="flex h-12 w-32 items-center justify-center text-lg font-semibold text-ink/55 sm:w-36">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={u} className="max-h-10 max-w-full object-contain" />
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

      {/* features */}
      <section id="features" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-10 px-4 sm:px-6">
        <p className="text-sm font-semibold text-pen">More than answers</p>
        <h2 className="mt-2 max-w-3xl text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">A teacher that keeps learning about you.</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink/70">Lumo watches with you, figures out why you&apos;re stuck, teaches it the way that works for you, and remembers it all semester.</p>
        <div className="mt-10">
          <FeatureGrid />
        </div>
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
        <div className="mt-12">
          <SubjectFlashcards />
        </div>
      </section>

      {/* students */}
      <section className="mx-auto mt-28 w-full max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-2xl text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">Built for students who learn from video.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              who: "High school",
              body: "AP Calc, AP Bio, AP Chem and SAT review videos. Ask the question you'd feel awkward raising in class.",
              art: <HighSchoolIllustration />,
              tint: "bg-[#fff1b8]",
              tilt: "md:-rotate-1",
            },
            {
              who: "College",
              body: "Recorded lectures, problem-set walkthroughs, and the 2 a.m. study session when office hours are long over.",
              art: <CollegeIllustration />,
              tint: "bg-[#dfe8ff]",
              tilt: "md:translate-y-4",
            },
            {
              who: "Exam season",
              body: "Every question you ask is saved with its timestamp and diagram, so your confusions turn into a review sheet.",
              art: <ExamIllustration />,
              tint: "bg-[#ffe1d2]",
              tilt: "md:rotate-1",
            },
          ].map((c) => (
            <article
              key={c.who}
              className={`${c.tint} ${c.tilt} rounded-3xl border-2 border-ink p-5 shadow-[6px_6px_0_#1c1b19] transition-transform hover:-translate-y-1 sm:p-6`}
            >
              <div className="rounded-2xl bg-white/60 p-3">{c.art}</div>
              <h3 className="mt-5 text-xl font-semibold">{c.who}</h3>
              <p className="mt-2 leading-relaxed text-ink/80">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-10 px-4 sm:px-6">
        <p className="text-center text-sm font-semibold text-pen">LumoTutor Plus · $9.99/month</p>
        <h2 className="mt-2 text-center text-[32px] font-semibold leading-tight tracking-tight sm:text-[44px]">Your personal AI teacher for every class.</h2>
        <div className="mt-10">
          <PricingCards signedIn={false} currentPlan={null} />
        </div>
        <p className="mx-auto mt-10 max-w-xl rounded-2xl border-2 border-dashed border-pen/40 bg-[#fff7ef] px-5 py-4 text-center">
          <span className="font-semibold">Invite 2 friends, unlock 14 days of Plus.</span>{" "}
          <span className="text-ink/70">Share your link in your class group chat once you sign up.</span>
        </p>
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
        <span className="font-semibold text-ink">LumoTutor</span>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <a href={`mailto:${SITE.supportEmail}`} className="hover:text-ink">
            Contact
          </a>
        </nav>
        <span>© {new Date().getFullYear()} LumoTutor</span>
      </footer>
    </main>
  );
}
