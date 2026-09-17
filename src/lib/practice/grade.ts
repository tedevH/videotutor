import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { withModelFallback } from "@/lib/ai/retry";
import { repairLatex } from "@/lib/tutor/latex-repair";
import { extractJson, gradeResult, type GradeResult, type PracticeItem } from "./schema";

const model = () => process.env.GEMINI_SOLVER_MODEL || process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/** Grades a student's answer and diagnoses the specific misconception behind a wrong one. */
export async function gradeAttempt(item: PracticeItem, answer: string): Promise<GradeResult> {
  const prompt = `Grade a student's answer to a practice problem. Be fair: accept equivalent forms (simplified or not, different but equal expressions, reasonable rounding, any valid scalar multiple for eigenvectors, etc.).
If equivalence of expressions or numbers is not obvious, check it with Python (sympy).

PROBLEM (${item.difficulty}, ${item.kind}):
${item.prompt}
${item.choices ? `Choices: ${item.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join("  ")}` : ""}

ANSWER KEY: ${item.solution.answer}
WORKED SOLUTION: ${item.solution.steps.join(" | ")}
KNOWN COMMON MISTAKES: ${item.solution.common_mistakes.map((m) => `${m.mistake} [${m.misconception_key}]`).join(" | ")}

STUDENT'S ANSWER:
${answer}

Decide:
- result: "correct" (right, possibly with trivial slips in notation), "partial" (right approach, an error in execution or incomplete), or "incorrect".
- diagnosis: WHY they got this answer — reconstruct their likely thinking (e.g. "subtracted 6 correctly but then divided only one side by 2"). Not just "wrong".
- misconception_key / misconception: if the error reflects a conceptual misunderstanding (not a random slip), name it; reuse a key from KNOWN COMMON MISTAKES when it matches. Empty strings otherwise.
- feedback: 1-3 sentences to the student. If not correct, don't reveal the final answer; point at the exact place their reasoning went wrong.
- next_step_hint: one nudge for their next try (empty if correct).

End with a JSON code block:
\`\`\`json
{"result": "...", "feedback": "...", "diagnosis": "...", "misconception_key": "", "misconception": "", "next_step_hint": ""}
\`\`\``;

  const res = await withModelFallback(model(), (m) =>
    new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }).models.generateContent({
      model: m,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { tools: [{ codeExecution: {} }], temperature: 0.1, maxOutputTokens: 3000, thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } },
    }),
  );
  const text = (res.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("\n");
  return gradeResult.parse(repairLatex(extractJson(text)));
}
