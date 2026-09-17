import { z } from "zod";

/**
 * Freeform diagrams live on a 100 x 60 grid. The model names *what* to draw and in
 * which step; the renderer handles pixels, sketch style and stroke animation.
 */
const point = z.tuple([z.number(), z.number()]);
const color = z.enum(["ink", "red", "blue", "green", "orange", "purple"]).catch("ink");

const base = {
  id: z.string().optional(),
  step: z.number().int().min(1).catch(1),
  color,
};

export const diagramElement = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("rect"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string().optional() }),
  z.object({ ...base, kind: z.literal("ellipse"), cx: z.number(), cy: z.number(), rx: z.number(), ry: z.number(), label: z.string().optional() }),
  z.object({ ...base, kind: z.literal("line"), points: z.array(point).min(2), dashed: z.boolean().optional() }),
  z.object({ ...base, kind: z.literal("arrow"), from: point, to: point, label: z.string().optional(), dashed: z.boolean().optional() }),
  z.object({ ...base, kind: z.literal("text"), x: z.number(), y: z.number(), text: z.string(), size: z.enum(["sm", "md", "lg"]).catch("md") }),
  z.object({ ...base, kind: z.literal("highlight"), cx: z.number(), cy: z.number(), r: z.number() }),
]);
export type DiagramElement = z.infer<typeof diagramElement>;

export const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), md: z.string() }),
  z.object({
    type: z.literal("diagram"),
    title: z.string().catch(""),
    elements: z.array(diagramElement).min(1),
    steps: z.array(z.object({ step: z.number().int(), narration: z.string() })).catch([]),
  }),
  z.object({ type: z.literal("flow"), title: z.string().catch(""), mermaid: z.string() }),
  z.object({
    type: z.literal("plot"),
    title: z.string().catch(""),
    functions: z.array(z.object({ fn: z.string(), label: z.string().optional() })).min(1),
    xDomain: z.tuple([z.number(), z.number()]).catch([-10, 10]),
    yDomain: z.tuple([z.number(), z.number()]).optional(),
  }),
  z.object({ type: z.literal("check_question"), question: z.string(), answer: z.string() }),
]);
export type Block = z.infer<typeof block>;

export const tutorResponse = z.object({
  misconception: z.string().catch(""),
  blocks: z.array(block).min(1),
  rewatch_from: z.number().nullable().catch(null),
});
export type TutorResponse = z.infer<typeof tutorResponse>;

export type UserContent = { text: string };
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  video_timestamp: number | null;
  content: UserContent | TutorResponse;
  created_at: string;
};

/** Gemini's structured video index. */
export const videoIndex = z.object({
  summary: z.string(),
  chunks: z.array(
    z.object({
      start_seconds: z.number(),
      end_seconds: z.number(),
      transcript: z.string().catch(""),
      visual: z.string().catch(""),
      on_screen_text: z.array(z.string()).catch([]),
      concepts: z.array(z.string()).catch([]),
    }),
  ),
});
export type VideoIndex = z.infer<typeof videoIndex>;
