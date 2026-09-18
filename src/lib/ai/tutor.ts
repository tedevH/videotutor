import { GoogleGenAI, PartMediaResolutionLevel, ThinkingLevel, type Part } from "@google/genai";
import { assertNotBlocked, SAFETY_SETTINGS } from "@/lib/ai/guard";
import { groundFrameBlock } from "@/lib/ai/ground";
import { compileExpr } from "@/lib/math-eval";
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
  drawingPng: string | null = null,
) {
  const t = Math.floor(timestamp);
  const parts: Part[] = [];
  const standalone = !media && !live;
  if (media) {
    parts.push(clipPart(media, t));
  } else if (standalone) {
    parts.push({ text: "There is no video: the student is working with Lumo directly on a whiteboard." });
  } else {
    // No direct access to the video: use what played in the student's browser.
    for (const [i, jpeg] of (live?.recentFrames ?? []).entries()) {
      parts.push({ text: `Frame ${i + 1} (older to newer):` }, { inlineData: { mimeType: "image/jpeg", data: jpeg } });
    }
    parts.push({ text: `Captions from the last few minutes of playback:\n${live?.captions || "(no captions available)"}` });
  }
  if (frameJpeg) parts.push({ text: "Exact frame at the pause:" }, framePart(frameJpeg));
  if (drawingPng) parts.push({ text: "The student's drawing on the whiteboard:" }, { inlineData: { mimeType: "image/png", data: drawingPng } });
  parts.push({
    text: `${standalone ? "The student" : media ? "This clip ends at the moment a student paused the video and" : "The frames and captions above end at the moment a student paused the video and"} asked: "${question}"
${drawingPng ? "In on_screen, describe the student's drawing precisely (what they drew, any mistakes or gaps in it).\n" : ""}

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
        safetySettings: SAFETY_SETTINGS,
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
        safetySettings: SAFETY_SETTINGS,
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
  input: {
    context: string;
    frameJpeg: string | null;
    timestamp: number;
    thinking?: ThinkingLevel;
    drawingPng?: string | null;
    question?: string;
    model?: string;
    surface?: "video" | "whiteboard" | "worksheet";
  },
): Promise<{ response: TutorResponse; model: string; usage: Usage }> {
  const model = input.model || tutorModel();
  const parts: Part[] = [{ text: input.context }];
  if (input.frameJpeg) parts.push({ text: "<paused_frame>" }, framePart(input.frameJpeg), { text: "</paused_frame>" });
  if (input.drawingPng) {
    parts.push({ text: "<student_drawing>" }, { inlineData: { mimeType: "image/png", data: input.drawingPng } }, { text: "</student_drawing>" });
  }

  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let contents = [{ role: "user", parts }];

  // Structured output guarantees valid JSON; one repair attempt covers schema details Zod rejects.
  let lastUsable: TutorResponse | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await withModelFallback(model, (m) =>
      client().models.generateContent({
        model: m,
        contents,
        config: {
          safetySettings: SAFETY_SETTINGS,
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
    // A safety block won't improve on retry; stop and let the route answer with a refusal.
    assertNotBlocked(res);
    const raw = res.text ?? "";

    let error: string;
    try {
      const parsed = tutorResponse.safeParse(repairLatex(JSON.parse(raw)));
      if (parsed.success) {
        const response = enforceRules(parsed.data, !!input.frameJpeg, input.timestamp);
        const problem = attempt < 2 ? teachingProblem(parsed.data, response, !!input.frameJpeg, input.question ?? "", input.surface ?? "video") : null;
        if (!problem) return input.frameJpeg ? groundFrames(response, input.frameJpeg, model, usage) : { response, model, usage };
        // Valid JSON but a weak answer: keep it as a fallback and ask for a fix.
        lastUsable = response;
        error = problem;
      } else {
        error = `Your JSON was invalid (${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}).`;
      }
    } catch {
      error = "Your response was not valid JSON.";
    }
    console.warn(`tutor answer rejected (attempt ${attempt + 1}): ${error}\n${raw.slice(0, 800)}`);
    contents = [
      ...contents,
      { role: "model", parts: [{ text: raw }] },
      { role: "user", parts: [{ text: `${error} Reply again with only the corrected JSON object.` }] },
    ];
  }
  if (lastUsable) return input.frameJpeg ? groundFrames(lastUsable, input.frameJpeg, model, usage) : { response: lastUsable, model, usage };

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
        safetySettings: SAFETY_SETTINGS,
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

/**
 * Checks that an answer actually teaches: a visual it planned can be shown, questions about the screen
 * get a visual, and "explain" moves explain rather than handing over a one-liner.
 */
function teachingProblem(raw: TutorResponse, enforced: TutorResponse, hasFrame: boolean, question: string, surface: "video" | "whiteboard" | "worksheet" = "video"): string | null {
  const asksForVisual = /\b(diagram|graph|draw|picture|plot|visual|show me|sketch)\b/i.test(question);
  const visuals = (r: TutorResponse) => r.blocks.filter((b) => VISUAL_TYPES.has(b.type));
  if (!hasFrame && raw.blocks.some((b) => b.type === "frame")) {
    return 'The paused frame is NOT available, so a "frame" block cannot be shown. Replace it with a visual that reproduces what is on screen from <screen_now> (e.g. a "plot" of the curve with the lines drawn as functions, a "board", or a "diagram"), and make the text explanation complete on its own.';
  }
  if (raw.plan.about_screen && visuals(enforced).length === 0 && (raw.plan.visual !== "none" || raw.plan.question_type === "visual" || asksForVisual)) {
    return 'This question is about a graph/diagram on screen, so the answer must include a visual that reproduces it (e.g. a "plot" with the curve AND every line and point the video draws, a "board", "diagram", or a subject visual). Add it, and keep the explanation.';
  }
  // On the whiteboard, a visual the student can't see on their board is no use: it must be board ops.
  if (surface === "whiteboard") {
    const shown = visuals(enforced);
    const offBoard = shown.filter((b) => b.type !== "board" && b.type !== "frame");
    if (offBoard.length && !shown.some((b) => b.type === "board")) {
      return `This is a whiteboard session, so the visual must be a "board" block drawn on the student's own board (a graph becomes a "graph" op, equations become "write" ops). Replace the "${offBoard[0].type}" block with a board block that builds on <board_now>, and keep the explanation.`;
    }
    if (!shown.length && asksForVisual) {
      return 'The student asked you to draw something on the whiteboard. Add a "board" block with the ops that draw it, placed in free space beside their own work.';
    }
  }
  const plotIssue = checkPlots(enforced);
  if (plotIssue) return plotIssue;
  const words = enforced.blocks
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.md : ""))
    .join(" ")
    .split(/\s+/).length;
  if (raw.move === "explain" && words < 45 && !enforced.blocks.some((b) => ["steps", "board"].includes(b.type))) {
    return 'Your "explain" move barely explains anything. Walk through the idea: what each part of the formula or diagram means and how they connect, in the video\'s notation. A check question can follow the explanation but never replace it.';
  }
  return null;
}

/**
 * Numerically checks graphs: every marked point should lie on some curve, and every extra line
 * (secant, tangent, approximation) should pass through at least one marked point.
 */
function checkPlots(response: TutorResponse): string | null {
  for (const b of response.blocks) {
    if (b.type !== "plot" || !b.points.length || b.functions.length < 2) continue;
    const fns = b.functions.map((f) => ({ label: f.label ?? f.fn, fn: f.fn, eval: compileExpr(f.fn, ["x"]) }));
    const near = (f: (typeof fns)[number], p: { x: number; y: number }) => {
      const y = f.eval?.(p.x);
      return y !== undefined && Number.isFinite(y) && Math.abs(y - p.y) <= 0.02 * Math.max(1, Math.abs(p.y));
    };
    const stray = b.points.find((p) => !fns.some((f) => near(f, p)));
    if (stray) return `In the plot "${b.title}", the point (${stray.x}, ${stray.y}) is not on any of the drawn functions. Fix the point or the equations.`;
    const offLine = fns.slice(1).find((f) => f.eval && !b.points.some((p) => near(f, p)));
    if (offLine) {
      const values = b.points.map((p) => `at x=${p.x} it gives ${Number(offLine.eval!(p.x).toFixed(3))}, not ${p.y}`).join("; ");
      return `In the plot "${b.title}", "${offLine.label}" (${offLine.fn}) does not pass through any marked point (${values}). Recompute its equation so it goes through the points it should connect.`;
    }
  }
  return null;
}

const VISUAL_TYPES = new Set(["frame", "plot", "diagram", "flow", "transform2d", "plot3d", "vector_field", "board", "molecule", "reaction", "free_body", "data_structure"]);

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
