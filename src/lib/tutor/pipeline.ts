import { ThinkingLevel } from "@google/genai";
import { addUsage, askTutor, lookAtMoment, needsSolving, reviewAnswer, solveWithCode, type Usage } from "@/lib/ai/tutor";
import { buildContext, buildOutline, describeMoment, REVIEW_PROMPT, SOLVER_PROMPT, SYSTEM_PROMPT, type ChunkRow } from "@/lib/tutor/prompt";
import type { Moment, TutorResponse } from "@/lib/tutor/schema";

const MOMENT_BEFORE = 150;
const MOMENT_AFTER = 20;

export type TutorInput = {
  videoId: string;
  timestamp: number;
  question: string;
  frameJpeg: string | null;
  video: { title: string | null; channel: string | null; summary: string | null; index_status: string };
  chunks: ChunkRow[];
  studentLevel: string;
  conversation: string;
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
  const look = await lookAtMoment(input.videoId, input.timestamp, input.frameJpeg, input.question).catch((err) => {
    console.error("look pass failed", err);
    return null;
  });

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
      screenNow: look ? describeMoment(look.moment) : "",
      verifiedWork,
      hasFrame: !!input.frameJpeg,
      conversation: input.conversation,
      question: input.question,
    });

  let usage: Usage = look?.usage ?? { inputTokens: 0, outputTokens: 0 };
  let verifiedWork: string | null = null;
  const hard = !!look && needsSolving(look.moment);
  if (hard) {
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
    timestamp: input.timestamp,
    // Without checked work, a hard question at least gets careful reasoning.
    thinking,
  });
  usage = addUsage(usage, answer.usage);

  // Hard questions: review for false or misleading claims, and rewrite once if any are found.
  let review: { ok: boolean; problems: string[] } | null = null;
  if (hard) {
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

  return {
    response: answer.response,
    model: answer.model,
    usage,
    moment: look?.moment ?? null,
    verifiedWork,
    review,
  };
}
