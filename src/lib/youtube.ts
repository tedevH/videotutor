import { YoutubeTranscript } from "youtube-transcript";

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Extracts the 11-char video id from any common YouTube URL form. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return checkId(url.pathname.slice(1));
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") return checkId(url.searchParams.get("v"));
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?]+)/);
      if (m) return checkId(m[2]);
    }
  } catch {
    return null;
  }
  return null;
}

function checkId(id: string | null | undefined) {
  return id && ID_RE.test(id) ? id : null;
}

export type TranscriptLine = { start: number; end: number; text: string };

/** Free captions from YouTube. Returns null when the video has none. */
export async function fetchTranscript(videoId: string): Promise<TranscriptLine[] | null> {
  try {
    // Prefer English captions; fall back to whatever track the video has.
    const lines = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" }).catch(() =>
      YoutubeTranscript.fetchTranscript(videoId),
    );
    if (!lines.length) return null;
    // The library reports ms for srv3 captions and seconds for classic ones;
    // no single caption line lasts over a minute, so large durations mean ms.
    const scale = lines.some((l) => l.duration > 60) ? 1 / 1000 : 1;
    return lines.map((l) => ({
      start: l.offset * scale,
      end: (l.offset + l.duration) * scale,
      text: decodeEntities(l.text),
    }));
  } catch {
    return null;
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;#39;|&#39;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
