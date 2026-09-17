import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";
import { withModelFallback } from "@/lib/ai/retry";

const model = () => process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export const courseExtraction = z.object({
  course_title: z.string().catch(""),
  subject: z.string().catch(""),
  summary: z.string().catch(""),
  exam_dates: z.array(z.object({ label: z.string(), date: z.string() })).catch([]),
  units: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().catch(""),
        concepts: z
          .array(
            z.object({
              name: z.string(),
              description: z.string().catch(""),
              prerequisites: z.array(z.string()).catch([]),
              exam_weight: z.number().catch(1),
              page: z.number().nullable().catch(null),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
});
export type CourseExtraction = z.infer<typeof courseExtraction>;

const jsonSchema = {
  type: "object",
  properties: {
    course_title: { type: "string" },
    subject: { type: "string" },
    summary: { type: "string" },
    exam_dates: { type: "array", items: { type: "object", properties: { label: { type: "string" }, date: { type: "string" } }, required: ["label", "date"] } },
    units: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          concepts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                prerequisites: { type: "array", items: { type: "string" } },
                exam_weight: { type: "number" },
                page: { type: ["number", "null"] },
              },
              required: ["name", "description", "prerequisites", "exam_weight"],
            },
          },
        },
        required: ["title", "concepts"],
      },
    },
  },
  required: ["subject", "summary", "units", "exam_dates"],
};

const KIND_GUIDE: Record<string, string> = {
  syllabus: "A syllabus: take the unit/topic schedule, exam dates and anything weighted heavily in grading.",
  slides: "Lecture slides: the concepts actually taught and how they build on each other.",
  notes: "Notes: the concepts covered.",
  textbook: "Textbook pages: sections and the concepts they teach.",
  homework: "A homework set: which concepts each problem exercises (these are likely exam-relevant).",
  exam: "A practice or past exam: which concepts are tested and how heavily (give them higher exam_weight).",
  other: "Course material.",
};

/** Reads one piece of course material and extracts its structure: units, concepts, prerequisites, exam dates. */
export async function extractCourseStructure(opts: {
  kind: string;
  title: string;
  file: { data: Buffer; mimeType: string } | { text: string };
  existingConcepts: string[];
  today: string;
}): Promise<CourseExtraction> {
  const parts: Part[] = [];
  if ("text" in opts.file) parts.push({ text: opts.file.text.slice(0, 200_000) });
  else parts.push({ inlineData: { mimeType: opts.file.mimeType, data: opts.file.data.toString("base64") } });

  parts.push({
    text: `${KIND_GUIDE[opts.kind] ?? KIND_GUIDE.other} Title: "${opts.title}". Today is ${opts.today}.

Build the course map a great TA would draw:
- units in teaching order, each with its concepts. A concept is one learnable, testable idea ("Chain rule", "Eigenvectors of symmetric matrices", "SN2 mechanism"), not a whole chapter and not a single fact.
- description: one sentence on what mastering it means.
- prerequisites: names of other concepts (in this course or basic ones) that must be understood first. Only real dependencies.
- exam_weight: 0.5 (minor) to 3 (central / heavily tested). Default 1.
- page: page or slide number where it's taught, if visible.
- exam_dates: any exams/quizzes with dates as YYYY-MM-DD (infer the year from context; skip if unknown).
${opts.existingConcepts.length ? `The course already has these concepts; reuse these exact names when the same idea appears: ${opts.existingConcepts.slice(0, 150).join("; ")}` : ""}`,
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await withModelFallback(model(), (m) =>
    ai.models.generateContent({
      model: m,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        temperature: 0.2,
        maxOutputTokens: 12000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );
  return courseExtraction.parse(JSON.parse(res.text ?? "{}"));
}

/** Maps what a lecture video covers (from its notes) onto the course's concepts, with timestamps. */
export async function mapVideoConcepts(opts: {
  concepts: string[];
  chunks: { start_seconds: number; concepts: string[]; transcript: string }[];
}): Promise<{ concept: string; start_seconds: number; is_new: boolean }[]> {
  const outline = opts.chunks
    .map((c) => `${c.start_seconds}s: ${c.concepts.join(", ") || c.transcript.slice(0, 80)}`)
    .join("\n");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await withModelFallback(model(), (m) =>
    ai.models.generateContent({
      model: m,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `A lecture video's outline (seconds: topics):
${outline}

Course concepts: ${opts.concepts.join("; ") || "(none yet)"}

For each course concept this lecture teaches, give the second where its main explanation starts. Also include important concepts the lecture teaches that aren't in the list (is_new true, with a short canonical name). Skip concepts only mentioned in passing.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "array",
          items: {
            type: "object",
            properties: { concept: { type: "string" }, start_seconds: { type: "number" }, is_new: { type: "boolean" } },
            required: ["concept", "start_seconds", "is_new"],
          },
        },
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );
  return JSON.parse(res.text ?? "[]");
}
