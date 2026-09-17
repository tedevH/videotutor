import { GoogleGenAI, type Content } from "@google/genai";
import { tutorResponse, type TutorResponse } from "@/lib/tutor/schema";

export type ChatTurn = { role: "user" | "model"; text: string };

export async function askTutor(system: string, turns: ChatTurn[]): Promise<{
  response: TutorResponse;
  model: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const model = process.env.GEMINI_TUTOR_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  let inputTokens = 0;
  let outputTokens = 0;
  let contents: Content[] = turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));

  // One repair attempt if the model returns JSON that doesn't match the schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 4000,
      },
    });
    inputTokens += res.usageMetadata?.promptTokenCount ?? 0;
    outputTokens += res.usageMetadata?.candidatesTokenCount ?? 0;
    const raw = res.text ?? "";

    let error: string;
    try {
      const parsed = tutorResponse.safeParse(JSON.parse(raw));
      if (parsed.success) return { response: parsed.data, model, inputTokens, outputTokens };
      error = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch {
      error = "Response was not valid JSON.";
    }
    contents = [
      ...contents,
      { role: "model", parts: [{ text: raw }] },
      { role: "user", parts: [{ text: `Your JSON was invalid (${error}). Reply again with only the corrected JSON object.` }] },
    ];
  }

  return {
    response: {
      misconception: "",
      blocks: [{ type: "text", md: "Sorry — I had trouble drawing that one. Could you ask again, maybe a bit more specifically?" }],
      rewatch_from: null,
    },
    model,
    inputTokens,
    outputTokens,
  };
}
