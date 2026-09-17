/**
 * Accuracy check for hard questions. Runs the real tutor pipeline on each case in
 * evals/cases.json, then has a grader compare the answer with the reference.
 *
 *   npm run eval                 all cases
 *   npm run eval -- la-3x3       cases whose id contains "la-3x3"
 *
 * Each case uses about 4 Gemini requests (look, solve, answer, grade).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { ingestVideo } from "../src/lib/ingest";
import { runTutor } from "../src/lib/tutor/pipeline";
import type { ChunkRow } from "../src/lib/tutor/prompt";

type Case = { id: string; videoId: string; timestamp: number; question: string; reference: string; preferredVisuals: string[] };
type Grade = { correct: boolean; score: number; errors: string[]; clarity: number; notes: string };

const filter = process.argv[2];
const cases = (JSON.parse(readFileSync("evals/cases.json", "utf8")) as Case[]).filter((c) => !filter || c.id.includes(filter));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function loadVideo(videoId: string) {
  let { data: video } = await db.from("videos").select("title, channel, summary, index_status").eq("id", videoId).maybeSingle();
  if (!video || video.index_status !== "ready") {
    if (!video) await db.from("videos").insert({ id: videoId });
    console.log(`  indexing ${videoId}...`);
    await ingestVideo(videoId);
    ({ data: video } = await db.from("videos").select("title, channel, summary, index_status").eq("id", videoId).single());
  }
  const { data: chunks } = await db.from("video_chunks").select("start_seconds, end_seconds, transcript, visual, on_screen_text, concepts").eq("video_id", videoId).order("start_seconds");
  return { video: video!, chunks: (chunks ?? []) as ChunkRow[] };
}

async function grade(c: Case, answerText: string): Promise<Grade> {
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_TUTOR_MODEL || "gemini-3.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Grade a tutor's answer to a student's question. Be strict about mathematical correctness.

QUESTION: ${c.question}

REFERENCE (correct content; the answer need not match wording, and equivalent forms such as scalar multiples of eigenvectors are fine):
${c.reference}

TUTOR ANSWER:
${answerText}

Return JSON: {"correct": boolean (true only if every mathematical claim is right and the question is actually answered), "score": 0-10, "errors": [each wrong or missing key point], "clarity": 0-10 (would a struggling student understand it?), "notes": "one sentence"}`,
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0, thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } },
  });
  return JSON.parse(res.text ?? "{}") as Grade;
}

/** Flattens the answer (including visuals' key data) into text the grader can read. */
function answerAsText(r: Awaited<ReturnType<typeof runTutor>>["response"]) {
  const parts = [r.misconception && `Misconception: ${r.misconception}`];
  for (const b of r.blocks) {
    if (b.type === "text") parts.push(b.md);
    else if (b.type === "steps") parts.push(b.steps.map((s, i) => `${i + 1}. ${s.math}   (${s.note})`).join("\n"));
    else if (b.type === "check_question") parts.push(`Check question: ${b.question} Answer: ${b.answer}`);
    else if (b.type === "transform2d") parts.push(`[visual: transform2d of matrix ${JSON.stringify(b.matrix)}]`);
    else if (b.type === "plot3d") parts.push(`[visual: plot3d z = ${b.z}]`);
    else if (b.type === "plot") parts.push(`[visual: plot of ${b.functions.map((f) => f.fn).join(", ")}]`);
    else parts.push(`[visual: ${b.type}]`);
  }
  return parts.filter(Boolean).join("\n\n");
}

const results: (Case & { seconds: number; grade: Grade; visuals: string[]; visualOk: boolean; answer: unknown; verifiedWork: string | null; moment: unknown })[] = [];
for (const c of cases) {
  console.log(`\n▶ ${c.id}`);
  const { video, chunks } = await loadVideo(c.videoId);
  const t0 = Date.now();
  const run = await runTutor({
    videoId: c.videoId,
    timestamp: c.timestamp,
    question: c.question,
    frameJpeg: null,
    video,
    chunks,
    studentLevel: "college",
    conversation: "",
  });
  const seconds = (Date.now() - t0) / 1000;
  const text = answerAsText(run.response);
  const g = await grade(c, text);
  const visuals = run.response.blocks.map((b) => b.type).filter((t) => t !== "text" && t !== "check_question");
  const visualOk = visuals.length === 0 ? c.preferredVisuals.includes("none") : visuals.some((v) => c.preferredVisuals.includes(v));

  console.log(`  ${g.correct ? "✅ correct" : "❌ incorrect"}  score ${g.score}/10  clarity ${g.clarity}/10  visuals [${visuals.join(", ") || "none"}] ${visualOk ? "✓" : "✗"}  ${seconds.toFixed(1)}s`);
  console.log(`  level=${run.moment?.level} compute=${run.moment?.needs_computation} proof=${run.moment?.needs_proof_or_derivation} solved=${!!run.verifiedWork} review=${run.review ? (run.review.ok ? "ok" : `fixed ${run.review.problems.length}`) : "-"}`);
  if (g.errors?.length) console.log(`  errors: ${g.errors.join(" | ")}`);
  results.push({ ...c, seconds, grade: g, visuals, visualOk, answer: run.response, verifiedWork: run.verifiedWork, moment: run.moment });
}

const correct = results.filter((r) => r.grade.correct).length;
const avg = (k: "score" | "clarity") => (results.reduce((n, r) => n + (r.grade[k] ?? 0), 0) / Math.max(1, results.length)).toFixed(1);
console.log(`\n${correct}/${results.length} correct · avg score ${avg("score")} · avg clarity ${avg("clarity")} · visuals ok ${results.filter((r) => r.visualOk).length}/${results.length}`);

mkdirSync("evals/results", { recursive: true });
const file = `evals/results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(results, null, 2));
console.log(`details: ${file}`);
