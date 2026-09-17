# VideoTutor

Paste a YouTube lesson. When you're confused, start typing — the video pauses and an AI tutor explains that exact moment, sketching diagrams from what the video just showed.

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

1. Create a [Supabase](https://supabase.com) project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
2. In Supabase → Authentication: enable **Email** (and optionally **Google**, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`), and add `http://localhost:3000/auth/callback` to the redirect URLs.
3. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
4. Copy `.env.example` to `.env.local` and fill it in.
5. Run:

```bash
npm install
npm run dev
```

`/dev-preview` renders a sample tutor answer (diagram, flowchart, plot) without any keys — useful when working on the renderers.

## Layout

```
src/app/                    pages + API routes
src/app/watch/[sessionId]/  the player + tutor chat
src/components/blocks/      answer renderers (sketch diagram, flow, plot, markdown, check question)
src/lib/ai/                 Gemini clients: video indexing and the tutor
src/lib/tutor/              response schema + prompts
supabase/migrations/        database schema with row-level security
```
