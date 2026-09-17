import { ThinkingLevel } from "@google/genai";
import { addUsage, askTutor, lookAtMoment, needsSolving, reviewAnswer, solveWithCode, type LiveContext, type Usage } from "@/lib/ai/tutor";
import type { Media } from "@/lib/media";
import { buildContext, buildOutline, describeMoment, REVIEW_PROMPT, SOLVER_PROMPT, SYSTEM_PROMPT, type ChunkRow } from "@/lib/tutor/prompt";
import type { Moment, TutorResponse } from "@/lib/tutor/schema";

const MOMENT_BEFORE = 150;
const MOMENT_AFTER = 20;

export type TutorInput = {
  /** What Gemini can watch directly; null for sources it can't (then `live` is used). */
  media: Media | null;
  live: LiveContext | null;
  timestamp: number;
  question: string;
  frameJpeg: string | null;
  /** PNG of what the student drew on the whiteboard, if they sent one. */
  drawingPng?: string | null;
  video: { title: string | null; channel: string | null; summary: string | null; index_status: string };
  chunks: ChunkRow[];
  studentLevel: string;
  conversation: string;
  mode?: "socratic" | "direct";
  /** Loads the student-model summary once the subject is known. */
  studentModel?: (subject: string) => Promise<string>;
  /** Code-checked solving and review for hard questions (paid plans). */
  verifiedMath?: boolean;
  /** Stronger model for the answer pass (Pro). */
  tutorModel?: string;
  /** Present when the student is answering Lumo's question: skip re-watching and re-solving. */
  followUp?: NonNullable<TutorResponse["context_cache"]> | null;
};

export type TutorRun = {
  response: TutorResponse;
  model: string;
  usage: Usage;
  moment: Moment | null;
  verifiedWork: string | null;
  review: { ok: boolean; problems: string[] } | null;
};

/**
 * One student question, end to end:
 *   1. look   what is on screen, and how hard is this?
 *   2. solve  hard questions only: high reasoning + executed code checks every result
 *   3. answer explain using only verified results, choosing the right visual
 *   4. review hard questions only: flag false or misleading claims, then rewrite once
 *   (frame annotations are placed inside askTutor when a frame was captured)
 */
export async function runTutor(input: TutorInput): Promise<TutorRun> {
  const reuse = input.followUp ?? null;
  const look = reuse
    ? null
    : await lookAtMoment(input.media, input.timestamp, input.frameJpeg, input.question, input.live, input.drawingPng ?? null).catch((err) => {
        console.error("look pass failed", err);
        return null;
      });
  const subject = reuse?.subject ?? look?.moment.subject ?? "";

  const studentModel = input.studentModel
    ? await input.studentModel(subject).catch((err) => {
        console.error("student model unavailable", err);
        return "";
      })
    : "";

  const contextFor = (verifiedWork: string | null) =>
    buildContext({
      title: input.video.title,
      channel: input.video.channel,
      summary: input.video.summary,
      level: input.studentLevel,
      timestamp: input.timestamp,
      outline: buildOutline(input.chunks),
      nearby: input.chunks.filter(
        (c) => c.start_seconds < input.timestamp + MOMENT_AFTER && c.end_seconds > input.timestamp - MOMENT_BEFORE,
      ),
      hasIndex: input.video.index_status === "ready",
      screenNow: reuse?.screen_now ?? (look ? describeMoment(look.moment) : ""),
      verifiedWork,
      hasFrame: !!input.frameJpeg,
      conversation: input.conversation,
      question: input.question,
      mode: input.mode ?? "socratic",
      studentModel,
    });

  let usage: Usage = look?.usage ?? { inputTokens: 0, outputTokens: 0 };
  let verifiedWork: string | null = reuse?.verified_work ?? null;
  const hard =
    input.verifiedMath !== false && (reuse ? reuse.level === "advanced" || !!reuse.verified_work : !!look && needsSolving(look.moment));
  if (hard && !reuse) {
    const solved = await solveWithCode(SOLVER_PROMPT, contextFor(null)).catch((err) => {
      console.error("solve pass failed", err);
      return null;
    });
    if (solved) {
      verifiedWork = solved.work;
      usage = addUsage(usage, solved.usage);
    }
  }

  const thinking = hard && !verifiedWork ? ThinkingLevel.HIGH : ThinkingLevel.LOW;
  let answer = await askTutor(SYSTEM_PROMPT, {
    context: contextFor(verifiedWork),
    frameJpeg: input.frameJpeg,
    drawingPng: input.drawingPng ?? null,
    question: input.question,
    model: input.tutorModel,
    timestamp: input.timestamp,
    // Without checked work, a hard question at least gets careful reasoning.
    thinking,
  });
  usage = addUsage(usage, answer.usage);

  // Hard questions: review for false or misleading claims, and rewrite once if any are found.
  let review: { ok: boolean; problems: string[] } | null = null;
  // Guiding questions and hints don't assert much; review the replies that teach content.
  const teachesContent = ["explain", "example", "wrap_up", "practice"].includes(answer.response.move);
  if (hard && teachesContent) {
    const reviewed = await reviewAnswer(REVIEW_PROMPT, contextFor(verifiedWork), answer.response).catch((err) => {
      console.error("review pass failed", err);
      return null;
    });
    if (reviewed) {
      usage = addUsage(usage, reviewed.usage);
      review = { ok: reviewed.ok, problems: reviewed.problems };
      if (!reviewed.ok) {
        const fixes = reviewed.problems.map((p) => `- ${p}`).join("\n");
        const revised = await askTutor(SYSTEM_PROMPT, {
          context: `${contextFor(verifiedWork)}\n\n<reviewer_corrections>\nA reviewer found these problems in your previous answer. Fix every one; keep what was right.\n${fixes}\n</reviewer_corrections>`,
          frameJpeg: input.frameJpeg,
          drawingPng: input.drawingPng ?? null,
          question: input.question,
          model: input.tutorModel,
          timestamp: input.timestamp,
          thinking: ThinkingLevel.MEDIUM,
        }).catch((err) => {
          console.error("revision failed", err);
          return null;
        });
        if (revised) {
          answer = revised;
          usage = addUsage(usage, revised.usage);
        }
      }
    }
  }

  const contextCache = {
    screen_now: reuse?.screen_now ?? (look ? describeMoment(look.moment) : ""),
    verified_work: verifiedWork,
    subject,
    level: reuse?.level ?? look?.moment.level ?? "intro",
    timestamp: input.timestamp,
  };

  return {
    response: { ...answer.response, context_cache: contextCache },
    model: answer.model,
    usage,
    moment: look?.moment ?? null,
    verifiedWork,
    review,
  };
}
