import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchTrustedVideoFile } from "@/lib/video-sources";

/** A video Gemini can watch: a YouTube URL or an uploaded Gemini file. */
export type Media = { fileUri: string; mimeType: string };

export type VideoRow = {
  id: string;
  provider: string;
  source_url: string | null;
  gemini_file_uri: string | null;
  gemini_file_mime: string | null;
  gemini_file_expires_at: string | null;
};

export const VIDEO_MEDIA_COLUMNS = "id, provider, source_url, gemini_file_uri, gemini_file_mime, gemini_file_expires_at";

const EXPIRY_MARGIN_MS = 60 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Returns something Gemini can watch for this video, or null when it can't watch it at all
 * (Vimeo: the tutor then works from captions and frames sent by the browser).
 */
export async function mediaForVideo(video: VideoRow): Promise<Media | null> {
  if (video.provider === "youtube") return { fileUri: `https://www.youtube.com/watch?v=${video.id}`, mimeType: "video/*" };
  if (video.provider !== "file" || !video.source_url) return null;

  const fresh = video.gemini_file_expires_at && new Date(video.gemini_file_expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS;
  if (video.gemini_file_uri && video.gemini_file_mime && fresh) {
    return { fileUri: video.gemini_file_uri, mimeType: video.gemini_file_mime };
  }
  return (await uploadVideoFile(video.id, video.source_url)).media;
}

/** Downloads a trusted video file and uploads it to Gemini. Uploads expire after about 48 hours. */
export async function uploadVideoFile(videoId: string, sourceUrl: string): Promise<{ media: Media; durationSeconds: number | null }> {
  const { blob, mimeType } = await fetchTrustedVideoFile(sourceUrl);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let file = await ai.files.upload({ file: blob, config: { mimeType, displayName: videoId } });

  const started = Date.now();
  while (file.state === "PROCESSING") {
    if (Date.now() - started > PROCESSING_TIMEOUT_MS) throw new Error("Gemini took too long to process the video");
    await new Promise((r) => setTimeout(r, 3000));
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== "ACTIVE" || !file.uri) throw new Error(`Gemini couldn't process the video (${file.state})`);

  const media = { fileUri: file.uri, mimeType: file.mimeType ?? mimeType };
  await createAdminClient()
    .from("videos")
    .update({
      gemini_file_uri: media.fileUri,
      gemini_file_mime: media.mimeType,
      gemini_file_expires_at: file.expirationTime ?? new Date(Date.now() + 47 * 3600 * 1000).toISOString(),
    })
    .eq("id", videoId);

  return { media, durationSeconds: parseDuration(file.videoMetadata) };
}

function parseDuration(meta: Record<string, unknown> | undefined) {
  const raw = meta?.videoDuration ?? meta?.video_duration;
  const seconds = typeof raw === "string" ? Number.parseFloat(raw) : typeof raw === "number" ? raw : Number.NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
}
