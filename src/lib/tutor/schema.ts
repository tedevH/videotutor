import { z } from "zod";

/**
 * Freeform diagrams live on a 100 x 60 grid. The model names *what* to draw and in
 * which step; the renderer handles pixels, sketch style and stroke animation.
 */
const point = z.tuple([z.number(), z.number()]);
const color = z.enum(["ink", "red", "blue", "green", "orange", "purple"]).catch("ink");
const frameColor = z.enum(["red", "yellow", "blue", "green", "orange", "purple", "white"]).catch("yellow");

/** Gemini's native spatial format: [ymin, xmin, ymax, xmax] and [y, x], normalized to 0-1000. */
const box2d = z.tuple([z.number(), z.number(), z.number(), z.number()]);
const yx = z.tuple([z.number(), z.number()]);

const frameBase = { step: z.number().int().min(1).catch(1), color: frameColor };

/**
 * The model names a `target` in plain words; a separate detection pass (lib/ai/ground.ts)
 * fills in the coordinates, because Gemini localizes far better in a dedicated detection call.
 */
export const frameAnnotation = z.object({
  ...frameBase,
  kind: z.enum(["circle", "box", "underline", "arrow", "label"]),
  target: z.string().catch(""),
  text: z.string().optional(),
  box_2d: box2d.optional(),
  from: yx.optional(),
  to: yx.optional(),
  point: yx.optional(),
});
export type FrameAnnotation = z.infer<typeof frameAnnotation>;

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

const steps = z.array(z.object({ step: z.number().int(), narration: z.string() })).catch([]);

/**
 * Whiteboard operations on a 100 x 60 board. Lumo writes, draws, graphs, highlights and erases,
 * revealed step by step like a teacher at a board.
 */
const boardColor = z.enum(["ink", "red", "blue", "green", "orange", "purple"]).catch("ink");
export const boardOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("write"),
    id: z.string().catch(""),
    step: z.number().int().min(1).catch(1),
    x: z.number(),
    y: z.number(),
    text: z.string(),
    size: z.enum(["sm", "md", "lg"]).catch("md"),
    color: boardColor,
  }),
  z.object({
    op: z.literal("draw"),
    id: z.string().catch(""),
    step: z.number().int().min(1).catch(1),
    shape: z.enum(["line", "arrow", "rect", "ellipse", "polyline"]),
    points: z.array(z.tuple([z.number(), z.number()])).min(2),
    color: boardColor,
    dashed: z.boolean().catch(false),
    label: z.string().catch(""),
  }),
  z.object({
    op: z.literal("graph"),
    id: z.string().catch(""),
    step: z.number().int().min(1).catch(1),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    fn: z.string(),
    xDomain: z.tuple([z.number(), z.number()]).catch([-5, 5]),
    yDomain: z.tuple([z.number(), z.number()]).nullable().catch(null),
    color: boardColor,
    shade: z.tuple([z.number(), z.number()]).nullable().catch(null),
  }),
  z.object({
    op: z.literal("highlight"),
    id: z.string().catch(""),
    step: z.number().int().min(1).catch(1),
    target: z.string().catch(""),
    x: z.number().catch(0),
    y: z.number().catch(0),
    w: z.number().catch(0),
    h: z.number().catch(0),
    color: boardColor,
  }),
  z.object({ op: z.literal("erase"), id: z.string().catch(""), step: z.number().int().min(1).catch(1), ids: z.array(z.string()) }),
]);
export type BoardOp = z.infer<typeof boardOp>;

export const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), md: z.string() }),
  z.object({
    type: z.literal("diagram"),
    title: z.string().catch(""),
    elements: z.array(diagramElement).min(1),
    steps,
  }),
  z.object({ type: z.literal("flow"), title: z.string().catch(""), mermaid: z.string() }),
  z.object({ type: z.literal("frame"), title: z.string().catch(""), focus: z.string().nullable().catch(null), crop: box2d.nullable().catch(null), annotations: z.array(frameAnnotation).catch([]), steps }),
  z.object({
    type: z.literal("plot"),
    title: z.string().catch(""),
    functions: z.array(z.object({ fn: z.string(), label: z.string().optional() })).min(1),
    xDomain: z.tuple([z.number(), z.number()]).catch([-10, 10]),
    yDomain: z.tuple([z.number(), z.number()]).optional(),
    shade: z.array(z.object({ fn: z.string(), from: z.number(), to: z.number() })).catch([]),
    points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().optional() })).catch([]),
    vlines: z.array(z.object({ x: z.number(), label: z.string().optional() })).catch([]),
  }),
  z.object({ type: z.literal("check_question"), question: z.string(), answer: z.string() }),
  z.object({ type: z.literal("board"), title: z.string().catch(""), ops: z.array(boardOp).min(1), steps }),
  z.object({
    type: z.literal("steps"),
    title: z.string().catch(""),
    steps: z.array(z.object({ math: z.string(), note: z.string().catch("") })).min(1),
  }),
  z.object({
    type: z.literal("transform2d"),
    title: z.string().catch(""),
    matrix: z.tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])]),
    vectors: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().catch("") })).catch([]),
    show_eigenvectors: z.boolean().catch(true),
  }),
  z.object({
    type: z.literal("plot3d"),
    title: z.string().catch(""),
    z: z.string(),
    xDomain: z.tuple([z.number(), z.number()]).catch([-3, 3]),
    yDomain: z.tuple([z.number(), z.number()]).catch([-3, 3]),
    view: z.enum(["surface", "contour"]).catch("surface"),
    points: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().catch("") })).catch([]),
    gradients_at: z.array(z.object({ x: z.number(), y: z.number() })).catch([]),
    tangent_plane_at: z.object({ x: z.number(), y: z.number() }).nullable().catch(null),
  }),
  z.object({
    type: z.literal("vector_field"),
    title: z.string().catch(""),
    fx: z.string(),
    fy: z.string(),
    xDomain: z.tuple([z.number(), z.number()]).catch([-3, 3]),
    yDomain: z.tuple([z.number(), z.number()]).catch([-3, 3]),
    curve: z.object({ x: z.string(), y: z.string(), t: z.tuple([z.number(), z.number()]) }).nullable().catch(null),
  }),
]);
export type Block = z.infer<typeof block>;

export const answerPlan = z.object({
  on_screen: z.string().catch(""),
  about_screen: z.boolean().catch(false),
  question_type: z.enum(["conceptual", "procedural", "factual", "visual", "follow_up", "off_topic"]).catch("conceptual"),
  visual: z.enum(["none", "frame", "plot", "diagram", "flow", "steps", "transform2d", "plot3d", "vector_field", "board"]).catch("none"),
  why: z.string().catch(""),
});

export const teachingMove = z.enum(["question", "hint", "example", "explain", "check", "practice", "wrap_up"]);
export type TeachingMove = z.infer<typeof teachingMove>;

/** What the tutor learned about the student this turn; feeds the student model. */
export const observation = z.object({
  concept: z.string(),
  subject: z.string().catch(""),
  signal: z.enum(["asked", "confused", "understood", "misconception"]),
  misconception_key: z.string().catch(""),
  misconception: z.string().catch(""),
});
export type Observation = z.infer<typeof observation>;

export const tutorResponse = z.object({
  plan: answerPlan.catch({ on_screen: "", about_screen: false, question_type: "conceptual", visual: "none", why: "" }),
  move: teachingMove.catch("explain"),
  awaiting_student: z.boolean().catch(false),
  resolved: z.boolean().catch(false),
  assessment: z
    .object({ result: z.enum(["correct", "partial", "incorrect", "not_applicable"]).catch("not_applicable"), diagnosis: z.string().catch("") })
    .catch({ result: "not_applicable", diagnosis: "" }),
  observations: z.array(observation).catch([]),
  misconception: z.string().catch(""),
  blocks: z.array(block).min(1),
  rewatch_from: z.number().nullable().catch(null),
});
/** `frame_path` is set by the server (never the model) when the student's paused frame was captured. */
export type TutorResponse = z.infer<typeof tutorResponse> & {
  frame_path?: string;
  /** Server-set: what this exchange was grounded in, reused while the student answers follow-ups. */
  context_cache?: { screen_now: string; verified_work: string | null; subject: string; level: string; timestamp: number };
};

export type UserContent = { text: string; frame_path?: string; drawing_path?: string };
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  video_timestamp: number | null;
  content: UserContent | TutorResponse;
  created_at: string;
  /** Short-lived signed URL for content.frame_path, added when messages are loaded. */
  frame_url?: string | null;
  drawing_url?: string | null;
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

/** Pass 1 output: what the student is looking at, and how hard the question is. */
export const moment = z.object({
  on_screen: z.string().catch(""),
  last_30_seconds: z.string().catch(""),
  subject: z.string().catch(""),
  level: z.enum(["intro", "intermediate", "advanced"]).catch("intro"),
  needs_computation: z.boolean().catch(false),
  needs_proof_or_derivation: z.boolean().catch(false),
});
export type Moment = z.infer<typeof moment>;
