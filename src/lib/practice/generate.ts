import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { recordUsage, usageFrom } from "@/lib/ai/meter";
import { withModelFallback } from "@/lib/ai/retry";
import type { Difficulty } from "@/lib/brain/model";
import { repairLatex } from "@/lib/tutor/latex-repair";
import { extractJson, problemDraft, type ProblemDraft } from "./schema";

const model = () => process.env.GEMINI_SOLVER_MODEL || process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  easy: "one idea, one or two steps, friendly numbers; builds confidence and isolates the core skill",
  medium: "a standard exam-style problem, 3-5 steps",
  hard: "combines this concept with a prerequisite or requires careful reasoning; the kind of problem that separates A and B students",
  transfer: "the same underlying concept in an unfamiliar context (a word problem, another subject, a real situation) where the student must first RECOGNIZE that this concept applies",
};

const KIND_GUIDE = {
  compute: "Ask for a concrete result the student computes.",
  recognize:
    "Test recognition, not mechanics: e.g. present a situation and ask which method/theorem applies and why, or which of several setups is valid. The student should not need a long calculation.",
  explain: "Ask the student to explain why something is true in their own words, or to find and fix the error in a short worked solution.",
  choice: "Multiple choice with 4 options; wrong options must each correspond to a specific common mistake.",
};

/**
 * Writes the next practice problem for a student. For quantitative problems the model must verify the
 * answer key with executed code before returning it.
 */
export async function generateProblem(opts: {
  concept: string;
  subject: string | null;
  description?: string | null;
  difficulty: Difficulty;
  kind: keyof typeof KIND_GUIDE;
  misconception?: string | null;
  recentPrompts: string[];
  level: string;
  userId?: string;
}): Promise<ProblemDraft> {
  const prompt = `Write ONE practice problem for a ${opts.level === "high_school" ? "high school" : "college"} student.

Concept: ${opts.concept}${opts.subject ? ` (${opts.subject})` : ""}${opts.description ? `\nWhat it covers: ${opts.description}` : ""}
Difficulty: ${opts.difficulty} — ${DIFFICULTY_GUIDE[opts.difficulty]}
Problem type: ${opts.kind} — ${KIND_GUIDE[opts.kind]}
${opts.misconception ? `This student has this misconception: "${opts.misconception}". Design the problem so that someone holding it would get it wrong, and someone who has fixed it gets it right.\n` : ""}${opts.recentPrompts.length ? `Do NOT repeat or lightly reword these recent problems (vary numbers AND context):\n${opts.recentPrompts.map((p) => `- ${p.slice(0, 160)}`).join("\n")}\n` : ""}
Rules:
- If anything is computed, verify the final answer with Python (sympy/numpy) before writing the answer key. Fix the problem if the numbers turn ugly unintentionally.
- Math in LaTeX with $...$. The prompt must be self-contained.
- hints: exactly 3, progressively more specific; the last nearly gives the next step but not the answer.
- common_mistakes: 2-3 likely wrong approaches, each with a misconception_key "concept-slug:short-kebab-description".
- choices: array of 4 strings only for multiple choice, otherwise null.

End your reply with the final problem as a JSON code block:
\`\`\`json
{"prompt": "...", "choices": null, "answer": "...", "steps": ["..."], "hints": ["...", "...", "..."], "common_mistakes": [{"mistake": "...", "misconception_key": "...", "why": "..."}], "skill_tested": "..."}
\`\`\``;

  const res = await withModelFallback(model(), (m) =>
    new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }).models.generateContent({
      model: m,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ codeExecution: {} }],
        temperature: 0.8,
        maxOutputTokens: 6000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    }),
  );
  await recordUsage(opts.userId ?? null, "practice", model(), usageFrom(res.usageMetadata));
  const text = (res.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("\n");
  return problemDraft.parse(repairLatex(extractJson(text)));
}
