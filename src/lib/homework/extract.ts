import { GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";
import { withModelFallback } from "@/lib/ai/retry";

const model = () => process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export const worksheetExtraction = z.object({
  title: z.string().catch(""),
  subject: z.string().catch(""),
  problems: z
    .array(
      z.object({
        label: z.string(),
        prompt: z.string(),
        page: z.number().catch(1),
        concept: z.string().catch(""),
      }),
    )
    .catch([]),
  page_text: z.array(z.object({ page: z.number(), text: z.string() })).catch([]),
});
export type WorksheetExtraction = z.infer<typeof worksheetExtraction>;

const jsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subject: { type: "string" },
    problems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          prompt: { type: "string" },
          page: { type: "number" },
          concept: { type: "string" },
        },
        required: ["label", "prompt", "page", "concept"],
      },
    },
    page_text: {
      type: "array",
      items: { type: "object", properties: { page: { type: "number" }, text: { type: "string" } }, required: ["page", "text"] },
    },
  },
  required: ["title", "subject", "problems", "page_text"],
};

/**
 * Reads the pages of an uploaded assignment and lists its problems, so each one can be
 * tutored separately and tied to a concept in the student model.
 */
export async function extractWorksheet(opts: {
  kind: string;
  title: string;
  pages: { page: number; data: Buffer; mimeType: string }[];
  existingConcepts: string[];
}): Promise<WorksheetExtraction> {
  const parts: Part[] = [];
  for (const p of opts.pages) {
    parts.push({ text: `<page number="${p.page}">` }, { inlineData: { mimeType: p.mimeType, data: p.data.toString("base64") } }, { text: "</page>" });
  }

  parts.push({
    text: `This is a student's ${opts.kind} titled "${opts.title}". List every problem on it.

- label: the problem's own numbering exactly as printed ("1", "3(b)", "II.4"). If nothing is numbered, use "1", "2", … in reading order.
- prompt: the full problem statement, in the assignment's own notation. Transcribe math as LaTeX inside $…$. Include the setup a problem refers to ("for the function above") so the problem stands alone.
- page: which page it appears on.
- concept: the one idea it exercises, named the way a course would ("Chain rule", "Gauss's law", "SN2 mechanism").
- page_text: for each page, everything printed on it (instructions, given data, tables), excluding the student's own handwriting.

Skip the header, name/date lines and instructions that aren't problems. Do NOT solve anything.
${opts.existingConcepts.length ? `Reuse these concept names exactly when the same idea appears: ${opts.existingConcepts.slice(0, 150).join("; ")}` : ""}`,
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await withModelFallback(model(), (m) =>
    ai.models.generateContent({
      model: m,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        temperature: 0.1,
        maxOutputTokens: 16000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );
  return worksheetExtraction.parse(JSON.parse(res.text ?? "{}"));
}
