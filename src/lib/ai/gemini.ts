import { GoogleGenAI, MediaResolution, ThinkingLevel, Type } from "@google/genai";
import { withRetry } from "@/lib/ai/retry";
import { videoIndex, type VideoIndex } from "@/lib/tutor/schema";
import type { TranscriptLine } from "@/lib/youtube";

const model = () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Long videos are indexed in segments so each request stays small and reliable.
const SEGMENT_SECONDS = 20 * 60;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    chunks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start_seconds: { type: Type.NUMBER },
          end_seconds: { type: Type.NUMBER },
          transcript: { type: Type.STRING },
          visual: { type: Type.STRING },
          on_screen_text: { type: Type.ARRAY, items: { type: Type.STRING } },
          concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["start_seconds", "end_seconds", "transcript", "visual", "on_screen_text", "concepts"],
      },
    },
  },
  required: ["summary", "chunks"],
};

function prompt(hasTranscript: boolean, from: number, to: number) {
  return `You are indexing an educational video so a tutor can later answer student questions about any moment.
Cover ONLY the range ${from}s to ${to}s. Split it into consecutive chunks of about 30-45 seconds (roughly ${Math.max(1, Math.round((to - from) / 40))} chunks), aligned to natural topic breaks. Do not merge long stretches into one chunk.

For each chunk:
- transcript: ${hasTranscript ? "a brief paraphrase of what is said (the exact captions are stored separately)" : "what is said, as close to verbatim as practical"}
- visual: precise description of what is ON SCREEN — diagrams (shapes, arrows, labels, how parts connect), graphs (axes, curves, marked points), equations, code, demonstrations. Describe only what you actually see. Write "speaker only" if nothing instructional is shown.
- on_screen_text: equations and key text exactly as written (use LaTeX for math)
- concepts: 1-4 short concept names

summary: 2-4 sentences on what this section teaches.`;
}

export async function indexVideo(
  videoId: string,
  durationSeconds: number | null,
  transcript: TranscriptLine[] | null,
): Promise<{ index: VideoIndex; inputTokens: number; outputTokens: number }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const total = durationSeconds ?? SEGMENT_SECONDS;
  const segments: [number, number][] = [];
  for (let s = 0; s < total; s += SEGMENT_SECONDS) segments.push([s, Math.min(s + SEGMENT_SECONDS, total)]);

  const results = await Promise.all(
    segments.map(async ([from, to]) => {
      const res = await withRetry(() => ai.models.generateContent({
        model: model(),
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}`, mimeType: "video/*" },
                videoMetadata: durationSeconds
                  ? { startOffset: `${from}s`, endOffset: `${to}s`, fps: 0.5 }
                  : { fps: 0.5 },
              },
              { text: prompt(!!transcript, from, to) },
            ],
          },
        ],
        config: {
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
          // Describing what's on screen needs little reasoning; thinking tokens are billed as output.
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      }));
      return {
        parsed: videoIndex.parse(JSON.parse(res.text ?? "{}")),
        inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }),
  );

  const chunks = results.flatMap((r) => r.parsed.chunks).sort((a, b) => a.start_seconds - b.start_seconds);

  // Replace paraphrases with the real captions where we have them.
  if (transcript) {
    for (const c of chunks) {
      const text = transcript
        .filter((l) => l.start >= c.start_seconds && l.start < c.end_seconds)
        .map((l) => l.text)
        .join(" ");
      if (text) c.transcript = text;
    }
  }

  return {
    index: { summary: results.map((r) => r.parsed.summary).join(" "), chunks },
    inputTokens: results.reduce((n, r) => n + r.inputTokens, 0),
    outputTokens: results.reduce((n, r) => n + r.outputTokens, 0),
  };
}

