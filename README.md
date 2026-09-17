# VideoTutor

Paste a YouTube lesson. When you're confused, start typing — the video pauses and an AI tutor explains that exact moment, sketching diagrams from what the video just showed.

## How it works

1. **Ingest (once per video, shared by all users)** — free YouTube captions are stored immediately, then Gemini Flash-Lite watches the video at low resolution and builds a timestamped index: what's said, what's on screen, equations, concepts (`src/lib/ingest.ts`, `src/lib/ai/gemini.ts`).
2. **Ask** — the first keypress in the chat pauses the video and records the timestamp. The question plus the index window around that moment goes to Gemini (`src/app/api/sessions/[id]/messages/route.ts`).
3. **Answer** — Gemini returns structured JSON blocks (`src/lib/tutor/schema.ts`): Markdown + KaTeX, hand-drawn step-by-step diagrams, Mermaid flowcharts, function plots, and a quick check question.

## Setup

1. Create a [Supabase](https://supabase.com) project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
2. In Supabase → Authentication: enable **Google** and **Email**, and add `http://localhost:3000/auth/callback` to the redirect URLs.
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
