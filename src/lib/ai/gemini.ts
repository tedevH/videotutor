import { GoogleGenAI, MediaResolution, ThinkingLevel, Type } from "@google/genai";
import { withRetry } from "@/lib/ai/retry";
import { videoIndex, type VideoIndex } from "@/lib/tutor/schema";
import type { Media } from "@/lib/media";
import type { TranscriptLine } from "@/lib/youtube";

const model = () => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Long videos are indexed in segments so each request stays small and finishes well
// under server timeouts; a few run at once to stay inside per-minute rate limits.
const SEGMENT_SECONDS = 10 * 60;
const SEGMENT_CONCURRENCY = 3;

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
Cover ONLY the range ${from}s to ${to}s. start_seconds and end_seconds are absolute seconds from the start of the video as plain numbers (e.g. 40:30 is 2430, not 4030). Split it into consecutive chunks of about 30-45 seconds (roughly ${Math.max(1, Math.round((to - from) / 40))} chunks), aligned to natural topic breaks. Do not merge long stretches into one chunk.

For each chunk:
- transcript: ${hasTranscript ? "a brief paraphrase of what is said (the exact captions are stored separately)" : "what is said, as close to verbatim as practical"}
- visual: precise description of what is ON SCREEN — diagrams (shapes, arrows, labels, how parts connect), graphs (axes, curves, marked points), equations, code, demonstrations. Describe only what you actually see. Write "speaker only" if nothing instructional is shown.
- on_screen_text: equations and key text exactly as written (use LaTeX for math)
- concepts: 1-4 short concept names

summary: 2-4 sentences on what this section teaches.`;
}

export async function indexVideo(
  media: Media,
  durationSeconds: number | null,
  transcript: TranscriptLine[] | null,
): Promise<{ index: VideoIndex; inputTokens: number; outputTokens: number }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const total = durationSeconds ?? SEGMENT_SECONDS;
  const segments: [number, number][] = [];
  for (let s = 0; s < total; s += SEGMENT_SECONDS) segments.push([s, Math.min(s + SEGMENT_SECONDS, total)]);

  const results = await mapLimit(segments, SEGMENT_CONCURRENCY, async ([from, to]) => {
      const res = await withRetry(() => ai.models.generateContent({
        model: model(),
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: media,
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
      const parsed = videoIndex.parse(JSON.parse(res.text ?? "{}"));
      return {
        parsed: { ...parsed, chunks: parsed.chunks.flatMap((c) => fixChunkTimes(c, from, to)) },
        inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
      };
  });

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


async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

type Chunk = VideoIndex["chunks"][number];

/**
 * Models sometimes write times as mm:ss digits (40:30 → 4030) or relative to the segment.
 * Repair times that fall outside the segment; drop chunks that can't be placed.
 */
function fixChunkTimes(c: Chunk, from: number, to: number): Chunk[] {
  const inRange = (s: number, e: number) => s >= from - 5 && s < to + 5 && e > s && e <= to + 60;
  const candidates: [number, number][] = [
    [c.start_seconds, c.end_seconds],
    [mmss(c.start_seconds), mmss(c.end_seconds)],
    [from + c.start_seconds, from + c.end_seconds],
  ];
  const fixed = candidates.find(([s, e]) => inRange(s, e));
  if (!fixed) return [];
  return [{ ...c, start_seconds: Math.max(from, fixed[0]), end_seconds: Math.min(to, fixed[1]) }];
}

function mmss(n: number) {
  const whole = Math.floor(n);
  return Math.floor(whole / 100) * 60 + (whole % 100);
}
