import { GoogleGenAI, PartMediaResolutionLevel, ThinkingLevel, type Part } from "@google/genai";
import { groundFrameBlock } from "@/lib/ai/ground";
import { withRetry } from "@/lib/ai/retry";
import { tutorJsonSchema } from "@/lib/tutor/json-schema";
import { tutorResponse, type TutorResponse } from "@/lib/tutor/schema";

/** How much video before the pause the tutor looks at directly. */
const CLIP_BEFORE_SECONDS = 30;

const client = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const tutorModel = () => process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export type Usage = { inputTokens: number; outputTokens: number };

const clipPart = (videoId: string, t: number): Part => ({
  fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}`, mimeType: "video/*" },
  videoMetadata: { startOffset: `${Math.max(0, t - CLIP_BEFORE_SECONDS)}s`, endOffset: `${t + 1}s`, fps: 1 },
  mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW },
});

const framePart = (jpeg: string): Part => ({
  inlineData: { mimeType: "image/jpeg", data: jpeg },
  mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
});

/**
 * Pass 1: look at the moment of the pause. Asked on its own, the model describes the screen
 * precisely; buried inside the full tutoring prompt it tends to skim the video.
 */
export async function lookAtMoment(videoId: string, timestamp: number, frameJpeg: string | null) {
  const t = Math.floor(timestamp);
  const parts: Part[] = [clipPart(videoId, t)];
  if (frameJpeg) parts.push({ text: "Exact frame at the pause:" }, framePart(frameJpeg));
  parts.push({
    text: `This clip ends at the moment a student paused the video. Report:

ON SCREEN AT THE PAUSE: describe precisely everything visible in the final second${frameJpeg ? " (the exact frame is attached)" : ""}: every graph (axes, tick values, curves and their equations, shaded regions and colors, marked points), diagram (parts, arrows, labels, how they connect), equations exactly as written (LaTeX), code, board work. Say where things are (top-left, center, etc.). If nothing instructional is visible, say "speaker only".

LAST 30 SECONDS: what was said and shown, in order, in 3-6 sentences.`,
  });

  const res = await withRetry(() =>
    client().models.generateContent({
      model: tutorModel(),
      contents: [{ role: "user", parts }],
      config: { temperature: 0.1, maxOutputTokens: 1500, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
    }),
  );
  return {
    description: res.text ?? "",
    usage: usageOf(res.usageMetadata),
  };
}

/** Pass 2: answer the question, grounded in pass 1 and (when captured) the exact frame. */
export async function askTutor(
  system: string,
  input: { context: string; frameJpeg: string | null; timestamp: number },
): Promise<{ response: TutorResponse; model: string; usage: Usage }> {
  const model = tutorModel();
  const parts: Part[] = [{ text: input.context }];
  if (input.frameJpeg) parts.push({ text: "<paused_frame>" }, framePart(input.frameJpeg), { text: "</paused_frame>" });

  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let contents = [{ role: "user", parts }];

  // Structured output guarantees valid JSON; one repair attempt covers schema details Zod rejects.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await withRetry(() =>
      client().models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: tutorJsonSchema,
          temperature: 0.3,
          maxOutputTokens: 6000,
          // Choosing a visual and locating things on the frame benefit from some reasoning.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
    );
    usage = addUsage(usage, usageOf(res.usageMetadata));
    const raw = res.text ?? "";

    let error: string;
    try {
      const parsed = tutorResponse.safeParse(JSON.parse(raw));
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

function usageOf(meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

const VISUAL_TYPES = new Set(["frame", "plot", "diagram", "flow"]);

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
