# LumoTutor

Paste a YouTube lesson. When you're confused, start typing — the video pauses and an AI tutor explains that exact moment, sketching diagrams from what the video just showed.

## The learning system

LumoTutor is a learning system, not just a chatbot: **observe → diagnose → teach → practice → measure → remember → adapt**.

| Piece | Where |
|---|---|
| **Lumo Brain** (student model): per-concept knowledge tracing + memory decay, misconceptions, which explanation styles work | `src/lib/brain/`, `/brain` |
| **Socratic tutoring**: question → hint → example → explain → check, grading the student's replies | `src/lib/tutor/prompt.ts`, `src/lib/tutor/pipeline.ts` |
| **Practice**: next-best problem (difficulty ladder, recognition vs mechanics, misconception-targeted), code-checked answers, diagnosis, hints | `src/lib/practice/`, `/practice` |
| **Whiteboard**: Lumo writes/draws/graphs/highlights/erases step by step; students draw back | `src/components/board/`, `/board` |
| **Courses**: syllabus/slides/notes/homework/exams/videos → units, concepts, prerequisites, exam plan | `src/lib/courses/`, `/courses` |
| **Memory**: spaced review of concepts you're forgetting | `src/lib/brain/review.ts`, `/home` |
| **Classroom mode**: voice questions, rewind/pause nudges, auto-resume | `src/app/watch/` |
| **Subject visuals**: frames, plots, 3D surfaces, linear maps, vector fields, molecules, reactions, free-body diagrams, data structures | `src/components/blocks/` |

## How it works

1. **Ingest (once per video, shared by all users)**: free YouTube captions are stored immediately, then Gemini Flash-Lite watches the video in 10-minute segments and builds timestamped notes: what's said, what's on screen, equations, concepts (`src/lib/ingest.ts`, `src/lib/ai/gemini.ts`).
2. **Ask**: the first keypress in the chat pauses the video and records the timestamp (and, if the student enabled it, the exact frame).
3. **Answer pipeline** (`src/lib/tutor/pipeline.ts`):
   1. **Look**: watch the 30s before the pause, describe the screen, classify the question (subject, level, needs computation / proof).
   2. **Solve** (hard questions only): high reasoning plus executed Python/SymPy; every result is checked by substitution.
   3. **Answer**: explain using only verified results, and pick a visual: annotated frame, 2D plot, 3D surface/contours, linear transformation, vector field, flowchart, sketch, or step-by-step derivation.
   4. **Review** (hard questions only): a strict reviewer flags false or misleading claims; the answer is rewritten once if needed.

Hard questions take about 15–50 seconds and 4–5 Gemini requests; simple ones take 2–3.

## Accuracy tests

`evals/cases.json` holds hard questions from real lectures (MIT 18.06 linear algebra, MIT 18.02 multivariable calculus) with hand-checked reference answers. The runner uses the same pipeline as the app and a grader model:

```bash
npm run eval            # all cases
npm run eval -- mv-     # only cases whose id contains "mv-"
```

Each case uses about 5 Gemini requests. Detailed results are written to `evals/results/`.

## Setup

1. Create a [Supabase](https://supabase.com) project, then run every file in `supabase/migrations/` in order (0001 → 0006) in the SQL editor.
2. In Supabase → Authentication: enable **Email** (and optionally **Google**, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`), and add `http://localhost:3000/auth/callback` to the redirect URLs.
3. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
4. Copy `.env.example` to `.env.local` and fill it in.
5. Run:

```bash
npm install
npm run dev
```

`/dev-preview` renders a sample tutor answer (diagram, flowchart, plot) without any keys — useful when working on the renderers.

## Video sources

`src/lib/video-sources.ts` decides what links are allowed:

| Source | How the tutor sees it |
|---|---|
| YouTube | Gemini watches it directly (notes ahead of time + the clip at each question) |
| Video files (.mp4/.webm/.mov) from `.edu` sites or the Internet Archive | Downloaded with redirect, DNS and size checks (≤ 400 MB), uploaded to Gemini, then same as YouTube |
| Vimeo | Gemini can't fetch it, so the browser sends captions it played plus frames (needs "exact diagrams" on) |

Everything else (other hosts, http, IP addresses, credentials in URLs, shorteners) is rejected.

## Billing (Stripe)

1. Add `STRIPE_SECRET_KEY` (start with a `sk_test_` key) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.local`.
2. `npm run stripe:setup` creates LumoTutor Plus ($9.99/mo, $79.99/yr) and Pro ($19.99/mo, $159.99/yr), found later by lookup key.
3. Webhooks: locally run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the printed `whsec_` secret in `STRIPE_WEBHOOK_SECRET`. In production, add an endpoint for `https://<your-domain>/api/stripe/webhook` with events `checkout.session.completed` and `customer.subscription.created/updated/deleted`.
4. In the Stripe Dashboard, save the Customer Portal settings once (required before "Manage billing" works).

Plan limits live in `src/lib/plans.ts`.

## Layout

```
src/app/                    pages + API routes
src/app/watch/[sessionId]/  the player + tutor chat
src/components/blocks/      answer renderers (sketch diagram, flow, plot, markdown, check question)
src/lib/ai/                 Gemini clients: video indexing and the tutor
src/lib/tutor/              response schema + prompts
supabase/migrations/        database schema with row-level security
```
