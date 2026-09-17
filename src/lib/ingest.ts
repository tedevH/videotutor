import { createAdminClient } from "@/lib/supabase/server";
import { indexVideo } from "@/lib/ai/gemini";
import { fetchTranscript, type TranscriptLine } from "@/lib/youtube";

const CAPTION_CHUNK_SECONDS = 40;

/**
 * Builds the shared index for a video. Captions are stored first so the tutor is
 * usable within seconds; Gemini's visual index replaces them when it finishes.
 */
export async function ingestVideo(videoId: string) {
  const db = createAdminClient();

  // Claim the job so concurrent requests don't index the same video twice.
  const { data: claimed } = await db
    .from("videos")
    .update({ index_status: "processing", index_error: null })
    .eq("id", videoId)
    .in("index_status", ["pending", "failed"])
    .select("id, duration_seconds");
  if (!claimed?.length) return;

  const transcript = await fetchTranscript(videoId);
  const duration =
    claimed[0].duration_seconds ?? (transcript ? Math.ceil(transcript[transcript.length - 1].end) : null);

  if (transcript) {
    await replaceChunks(videoId, captionChunks(videoId, transcript));
    if (duration) await db.from("videos").update({ duration_seconds: duration }).eq("id", videoId);
  }

  try {
    const { index, inputTokens, outputTokens } = await indexVideo(videoId, duration, transcript);
    const visualChunks = index.chunks.map((c) => ({
        video_id: videoId,
        start_seconds: Math.floor(c.start_seconds),
        end_seconds: Math.ceil(c.end_seconds),
        transcript: c.transcript,
        visual: c.visual,
        on_screen_text: c.on_screen_text,
        concepts: c.concepts,
      }));
    // Keep caption-only notes for any stretch the visual pass skipped, so no moment is blank.
    const covered = (start: number, end: number) =>
      visualChunks.some((v) => v.start_seconds < end && v.end_seconds > start);
    const fillers = transcript ? captionChunks(videoId, transcript).filter((c) => !covered(c.start_seconds, c.end_seconds)) : [];
    await replaceChunks(videoId, [...visualChunks, ...fillers].sort((a, b) => a.start_seconds - b.start_seconds));
    await db.from("videos").update({ index_status: "ready", summary: index.summary }).eq("id", videoId);
    await db.from("usage_events").insert({
      kind: "ingest",
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });
  } catch (err) {
    console.error("ingest failed", videoId, err);
    await db
      .from("videos")
      .update({ index_status: "failed", index_error: err instanceof Error ? err.message.slice(0, 500) : "unknown" })
      .eq("id", videoId);
  }
}

function captionChunks(videoId: string, lines: TranscriptLine[]) {
  const chunks = new Map<number, string[]>();
  for (const l of lines) {
    const start = Math.floor(l.start / CAPTION_CHUNK_SECONDS) * CAPTION_CHUNK_SECONDS;
    chunks.set(start, [...(chunks.get(start) ?? []), l.text]);
  }
  return [...chunks].map(([start, texts]) => ({
    video_id: videoId,
    start_seconds: start,
    end_seconds: start + CAPTION_CHUNK_SECONDS,
    transcript: texts.join(" "),
    visual: "",
    on_screen_text: [],
    concepts: [],
  }));
}

async function replaceChunks(videoId: string, rows: Record<string, unknown>[]) {
  const db = createAdminClient();
  await db.from("video_chunks").delete().eq("video_id", videoId);
  // Gemini may emit two chunks with the same start; keep the first.
  const seen = new Set<unknown>();
  const unique = rows.filter((r) => !seen.has(r.start_seconds) && seen.add(r.start_seconds));
  const { error } = await db.from("video_chunks").insert(unique);
  if (error) throw error;
}
