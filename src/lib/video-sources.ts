import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { parseYouTubeId } from "@/lib/youtube";

export type Provider = "youtube" | "vimeo" | "file";

export type ResolvedVideo = {
  provider: Provider;
  /** Primary key in `videos`. YouTube keeps the bare id for backwards compatibility. */
  id: string;
  sourceUrl: string;
  /** What the client player needs: YouTube id, Vimeo URL, or the file URL. */
  playbackId: string;
};

export type Rejection = { error: string };

const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|mov)$/i;

/**
 * Hosts allowed to serve direct video files. Kept to universities and the Internet Archive:
 * the server downloads these files, so an open list would invite abuse (and SSRF).
 */
function isTrustedFileHost(host: string) {
  return (
    host === "archive.org" ||
    host.endsWith(".archive.org") ||
    /(^|\.)[a-z0-9-]+\.edu$/.test(host) ||
    /(^|\.)(ac\.uk|edu\.au|ac\.nz|edu\.sg|ac\.jp)$/.test(host)
  );
}

export const SUPPORTED_SOURCES = "YouTube, Vimeo, or a video file (.mp4, .webm, .mov) hosted by a university or the Internet Archive";

/** Turns a pasted link into a supported source, or explains why it's not allowed. */
export function resolveVideoUrl(input: string): ResolvedVideo | Rejection {
  const raw = input.trim();

  const youtubeId = parseYouTubeId(raw);
  if (youtubeId) {
    return { provider: "youtube", id: youtubeId, sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`, playbackId: youtubeId };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: `Paste a full link. Supported: ${SUPPORTED_SOURCES}.` };
  }

  // Refuse anything that looks like it's trying to reach something other than a public website.
  if (url.protocol !== "https:") return { error: "Only secure (https) links are supported." };
  if (url.username || url.password) return { error: "Links with embedded credentials aren't allowed." };
  if (url.port) return { error: "Links with custom ports aren't allowed." };
  const host = url.hostname.toLowerCase();
  if (isIpAddress(host) || host === "localhost" || !host.includes(".")) return { error: "That link isn't a public video site." };

  const vimeo = host.replace(/^www\./, "");
  if (vimeo === "vimeo.com" || vimeo === "player.vimeo.com") {
    const m = url.pathname.match(/^\/(?:video\/)?(\d{5,12})(?:\/([a-f0-9]{6,20}))?\/?$/);
    if (!m) return { error: "That Vimeo link doesn't point to a single video." };
    const hash = m[2] ?? url.searchParams.get("h");
    const canonical = `https://vimeo.com/${m[1]}${hash ? `/${hash}` : ""}`;
    return { provider: "vimeo", id: `vimeo:${m[1]}`, sourceUrl: canonical, playbackId: canonical };
  }

  if (VIDEO_EXTENSIONS.test(url.pathname)) {
    if (!isTrustedFileHost(host)) {
      return { error: "Direct video files are only supported from university (.edu) sites and the Internet Archive for now." };
    }
    url.hash = "";
    const clean = url.toString();
    return { provider: "file", id: `file:${createHash("sha256").update(clean).digest("hex").slice(0, 24)}`, sourceUrl: clean, playbackId: clean };
  }

  return { error: `That site isn't supported yet. Supported: ${SUPPORTED_SOURCES}.` };
}

function isIpAddress(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
}

const MAX_FILE_BYTES = 400 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/**
 * Downloads a direct video file for analysis. Every redirect hop must stay on a trusted host,
 * the response must be a video, and size is capped.
 */
export async function fetchTrustedVideoFile(sourceUrl: string): Promise<{ blob: Blob; mimeType: string }> {
  let current = sourceUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(current);
    if (url.protocol !== "https:" || url.port || isIpAddress(url.hostname) || !isTrustedFileHost(url.hostname.toLowerCase())) {
      throw new Error(`Refusing to download from ${url.hostname}`);
    }
    await assertPublicAddress(url.hostname);
    const res = await fetch(url, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without a location");
      current = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Video download failed (${res.status})`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const length = Number(res.headers.get("content-length") ?? 0);
    const mimeType = type.startsWith("video/") ? type : mimeFromPath(url.pathname);
    if (!mimeType) throw new Error(`Not a video (${type || "unknown type"})`);
    if (length > MAX_FILE_BYTES) throw new Error("Video is too large (over 400 MB)");

    const blob = await res.blob();
    if (blob.size > MAX_FILE_BYTES) throw new Error("Video is too large (over 400 MB)");
    return { blob, mimeType };
  }
  throw new Error("Too many redirects");
}

/** Blocks trusted-looking hostnames that resolve to private or loopback addresses. */
async function assertPublicAddress(hostname: string) {
  const addresses = await lookup(hostname, { all: true });
  for (const { address } of addresses) {
    const private4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(address);
    const private6 = address === "::1" || /^(fc|fd|fe80)/i.test(address) || address.startsWith("::ffff:");
    if (private4 || private6) throw new Error(`Refusing to download from a private address (${hostname})`);
  }
}

function mimeFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : ext === "mp4" || ext === "m4v" ? "video/mp4" : null;
}

/** Title and thumbnail for the library card. */
export async function fetchSourceMeta(video: ResolvedVideo): Promise<{ title: string | null; channel: string | null; thumbnail_url: string | null } | null> {
  if (video.provider === "youtube") {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video.sourceUrl)}`);
    if (!res.ok) return null;
    const d = (await res.json()) as { title?: string; author_name?: string };
    return { title: d.title ?? null, channel: d.author_name ?? null, thumbnail_url: `https://i.ytimg.com/vi/${video.playbackId}/mqdefault.jpg` };
  }
  if (video.provider === "vimeo") {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.sourceUrl)}`);
    if (!res.ok) return null;
    const d = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return { title: d.title ?? null, channel: d.author_name ?? null, thumbnail_url: d.thumbnail_url ?? null };
  }
  const url = new URL(video.sourceUrl);
  const file = decodeURIComponent(url.pathname.split("/").pop() ?? "Video");
  return { title: file.replace(VIDEO_EXTENSIONS, "").replace(/[_-]+/g, " "), channel: url.hostname.replace(/^www\./, ""), thumbnail_url: null };
}
