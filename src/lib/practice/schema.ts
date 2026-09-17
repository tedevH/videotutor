import { z } from "zod";

export const problemDraft = z.object({
  prompt: z.string().min(5),
  choices: z.array(z.string()).nullable().catch(null),
  answer: z.string(),
  steps: z.array(z.string()).catch([]),
  hints: z.array(z.string()).catch([]),
  common_mistakes: z
    .array(z.object({ mistake: z.string(), misconception_key: z.string().catch(""), why: z.string().catch("") }))
    .catch([]),
  skill_tested: z.string().catch(""),
});
export type ProblemDraft = z.infer<typeof problemDraft>;

export const gradeResult = z.object({
  result: z.enum(["correct", "partial", "incorrect"]),
  feedback: z.string(),
  diagnosis: z.string().catch(""),
  misconception_key: z.string().catch(""),
  misconception: z.string().catch(""),
  next_step_hint: z.string().catch(""),
});
export type GradeResult = z.infer<typeof gradeResult>;

export type PracticeItem = {
  id: string;
  concept_id: string;
  difficulty: "easy" | "medium" | "hard" | "transfer";
  kind: "compute" | "recognize" | "explain" | "choice";
  prompt: string;
  choices: string[] | null;
  solution: ProblemDraft;
  targets_misconception: string | null;
};

/** Pulls the last JSON object out of a model reply that also contains code and prose. */
export function extractJson(text: string): unknown {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].pop()?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}
