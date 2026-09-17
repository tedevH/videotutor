import { GoogleGenAI, PartMediaResolutionLevel, ThinkingLevel, type Part } from "@google/genai";
import { groundFrameBlock } from "@/lib/ai/ground";
import { repairLatex } from "@/lib/tutor/latex-repair";
import { withModelFallback } from "@/lib/ai/retry";
import type { Media } from "@/lib/media";
import { momentJsonSchema, tutorJsonSchema } from "@/lib/tutor/json-schema";
import { moment, tutorResponse, type Moment, type TutorResponse } from "@/lib/tutor/schema";

/** How much video before the pause the tutor looks at directly. */
const CLIP_BEFORE_SECONDS = 30;

const client = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const tutorModel = () => process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export type Usage = { inputTokens: number; outputTokens: number };

const clipPart = (media: Media, t: number): Part => ({
  fileData: media,
  videoMetadata: { startOffset: `${Math.max(0, t - CLIP_BEFORE_SECONDS)}s`, endOffset: `${t + 1}s`, fps: 1 },
  mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW },
});

const framePart = (jpeg: string): Part => ({
  inlineData: { mimeType: "image/jpeg", data: jpeg },
  mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
});

/**
 * Pass 1: look at the moment of the pause and size up the question. Asked on its own, the model
 * describes the screen precisely; buried inside the full tutoring prompt it tends to skim the video.
 */
export type LiveContext = {
  /** Captions the browser saw during playback, most recent last. */
  captions: string;
  /** Frames captured every few seconds before the pause, oldest first. */
  recentFrames: string[];
};

export async function lookAtMoment(
  media: Media | null,
  timestamp: number,
  frameJpeg: string | null,
  question: string,
  live: LiveContext | null,
) {
  const t = Math.floor(timestamp);
  const parts: Part[] = [];
  if (media) {
    parts.push(clipPart(media, t));
  } else {
    // No direct access to the video: use what played in the student's browser.
    for (const [i, jpeg] of (live?.recentFrames ?? []).entries()) {
      parts.push({ text: `Frame ${i + 1} (older to newer):` }, { inlineData: { mimeType: "image/jpeg", data: jpeg } });
    }
    parts.push({ text: `Captions from the last few minutes of playback:\n${live?.captions || "(no captions available)"}` });
  }
  if (frameJpeg) parts.push({ text: "Exact frame at the pause:" }, framePart(frameJpeg));
  parts.push({
    text: `${media ? "This clip ends" : "The frames and captions above end"} at the moment a student paused the video and asked: "${question}"

Report as JSON:
- on_screen: precisely everything visible in the final second${frameJpeg ? " (the exact frame is attached)" : ""}: every graph (axes, tick values, curves and their equations, shaded regions and colors, marked points), diagram (parts, arrows, labels, how they connect), equations and matrices exactly as written (LaTeX), code, board work, and where each thing is. "speaker only" if nothing instructional is visible.
- last_30_seconds: what was said and shown, in order, in 3-6 sentences.
- subject: the specific course topic (e.g. "linear algebra: eigenvalues", "multivariable calculus: gradients").
- level: "intro" (high school / first-year), "intermediate", or "advanced" (upper-division: linear algebra, multivariable, differential equations, real analysis, physical chemistry, etc.).
- needs_computation: true if a correct answer requires computing something (a matrix, integral, derivative, eigenvalues, numeric result) rather than only explaining.
- needs_proof_or_derivation: true if the answer should walk through a derivation, proof, or multi-step argument.`,
  });

  const res = await withModelFallback(tutorModel(), (m) =>
    client().models.generateContent({
      model: m,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseJsonSchema: momentJsonSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    }),
  );
  return { moment: moment.parse(JSON.parse(res.text ?? "{}")), usage: usageOf(res.usageMetadata) };
}

export function needsSolving(m: Moment) {
  return m.needs_computation || m.needs_proof_or_derivation || m.level === "advanced";
}

/**
 * Pass 2 (hard questions only): work the problem out with high reasoning and real code
 * execution, so every number and symbolic result in the final answer has been checked.
 */
export async function solveWithCode(system: string, context: string) {
  const res = await withModelFallback(process.env.GEMINI_SOLVER_MODEL || tutorModel(), (m) =>
    client().models.generateContent({
      model: m,
      contents: [{ role: "user", parts: [{ text: context }] }],
      config: {
        systemInstruction: system,
        tools: [{ codeExecution: {} }],
        temperature: 0.2,
        maxOutputTokens: 8000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    }),
  );

  // Keep the model's reasoning text and the actual program output; the output is the ground truth.
  const work = (res.candidates?.[0]?.content?.parts ?? [])
    .map((p) => {
      if (p.text) return p.text;
      if (p.codeExecutionResult?.output) return `[code output]\n${p.codeExecutionResult.output.trim()}`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
  return { work, usage: usageOf(res.usageMetadata) };
}

/** Pass 3: answer the question, grounded in the earlier passes and (when captured) the exact frame. */
export async function askTutor(
  system: string,
  input: { context: string; frameJpeg: string | null; timestamp: number; thinking?: ThinkingLevel },
): Promise<{ response: TutorResponse; model: string; usage: Usage }> {
  const model = tutorModel();
  const parts: Part[] = [{ text: input.context }];
  if (input.frameJpeg) parts.push({ text: "<paused_frame>" }, framePart(input.frameJpeg), { text: "</paused_frame>" });

  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let contents = [{ role: "user", parts }];

  // Structured output guarantees valid JSON; one repair attempt covers schema details Zod rejects.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await withModelFallback(model, (m) =>
      client().models.generateContent({
        model: m,
        contents,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: tutorJsonSchema,
          temperature: 0.3,
          maxOutputTokens: 6000,
          // Choosing a visual and locating things on the frame benefit from some reasoning.
          thinkingConfig: { thinkingLevel: input.thinking ?? ThinkingLevel.LOW },
        },
      }),
    );
    usage = addUsage(usage, usageOf(res.usageMetadata));
    const raw = res.text ?? "";

    let error: string;
    try {
      const parsed = tutorResponse.safeParse(repairLatex(JSON.parse(raw)));
      if (parsed.success) {
        const response = enforceRules(parsed.data, !!input.frameJpeg, input.timestamp);
        return input.frameJpeg ? groundFrames(response, input.frameJpeg, model, usage) : { response, model, usage };
      }
      error = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch {
      error = "Response was not valid JSON.";
    }
    console.warn(`tutor JSON rejected (attempt ${attempt + 1}): ${error}\n${raw.slice(0, 1500)}`);
    contents = [
      ...contents,
      { role: "model", parts: [{ text: raw }] },
      { role: "user", parts: [{ text: `Your JSON was invalid (${error}). Reply again with only the corrected JSON object.` }] },
    ];
  }

  return {
    response: {
      plan: { on_screen: "", about_screen: false, question_type: "conceptual", visual: "none", why: "" },
      move: "explain",
      awaiting_student: false,
      resolved: false,
      assessment: { result: "not_applicable", diagnosis: "" },
      observations: [],
      misconception: "",
      blocks: [{ type: "text", md: "Sorry, I had trouble answering that one. Could you ask again, maybe a bit more specifically?" }],
      rewatch_from: null,
    },
    model,
    usage,
  };
}

/** Resolves frame annotation targets to coordinates; drops the frame block if nothing could be placed. */
async function groundFrames(response: TutorResponse, frameJpeg: string, model: string, usage: Usage) {
  let total = usage;
  const blocks = await Promise.all(
    response.blocks.map(async (b) => {
      if (b.type !== "frame") return b;
      try {
        const grounded = await groundFrameBlock(b, frameJpeg, model);
        total = addUsage(total, grounded.usage);
        return grounded.block.annotations.length ? grounded.block : null;
      } catch (err) {
        console.error("frame grounding failed", err);
        return null;
      }
    }),
  );
  return { response: { ...response, blocks: blocks.filter((b) => b !== null) }, model, usage: total };
}

/** Pass 4 (hard questions only): catch false or misleading claims the code checks can't see. */
export async function reviewAnswer(system: string, context: string, answer: TutorResponse) {
  const res = await withModelFallback(process.env.GEMINI_SOLVER_MODEL || tutorModel(), (m) =>
    client().models.generateContent({
      model: m,
      contents: [{ role: "user", parts: [{ text: `${context}\n\n<tutor_answer>\n${JSON.stringify(answer.blocks)}\n</tutor_answer>` }] }],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: { ok: { type: "boolean" }, problems: { type: "array", items: { type: "string" } } },
          required: ["ok", "problems"],
        },
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    }),
  );
  const parsed = JSON.parse(res.text ?? "{}") as { ok?: boolean; problems?: string[] };
  const problems = parsed.problems ?? [];
  return { ok: parsed.ok !== false && problems.length === 0, problems, usage: usageOf(res.usageMetadata) };
}

function usageOf(meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

const VISUAL_TYPES = new Set(["frame", "plot", "diagram", "flow", "transform2d", "plot3d", "vector_field"]);

/** Applies the visual rules the prompt asks for, in case the model ignores them. */
function enforceRules(response: TutorResponse, hasFrame: boolean, pausedAt: number): TutorResponse {
  let seenVisual = false;
  const blocks = response.blocks.filter((b) => {
    if (!VISUAL_TYPES.has(b.type)) return true;
    if (b.type === "frame" && !hasFrame) return false;
    if (response.plan.visual === "none" || seenVisual) return false;
    seenVisual = true;
    return true;
  });
  const rewatch = response.rewatch_from;
  return {
    ...response,
    blocks: blocks.length ? blocks : response.blocks.filter((b) => b.type === "text").slice(0, 1),
    rewatch_from: rewatch !== null && rewatch >= 0 && rewatch <= pausedAt ? Math.floor(rewatch) : null,
  };
}
