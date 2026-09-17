import { createAdminClient } from "@/lib/supabase/server";
import type { StoredMessage } from "@/lib/tutor/schema";

const BUCKET = "frames";
const URL_TTL_SECONDS = 60 * 60 * 6;

/** Stores a paused frame or a student drawing. Returns null on failure so the question still gets answered. */
export async function uploadFrame(userId: string, sessionId: string, base64: string, contentType: "image/jpeg" | "image/png" = "image/jpeg") {
  const path = `${userId}/${sessionId}/${crypto.randomUUID()}.${contentType === "image/png" ? "png" : "jpg"}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, Buffer.from(base64, "base64"), { contentType });
  if (error) {
    console.error("frame upload failed", error.message);
    return null;
  }
  return path;
}

/** Adds short-lived signed URLs for any message that references a stored frame. */
export async function signFrameUrls<T extends Pick<StoredMessage, "content">>(messages: T[]) {
  const pathsOf = (m: T) => {
    const c = m.content as { frame_path?: string; drawing_path?: string };
    return [c.frame_path, c.drawing_path].filter((p): p is string => !!p);
  };
  const paths = [...new Set(messages.flatMap(pathsOf))];
  if (!paths.length) return messages.map((m) => ({ ...m, frame_url: null, drawing_url: null }));

  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SECONDS);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return messages.map((m) => {
    const c = m.content as { frame_path?: string; drawing_path?: string };
    return { ...m, frame_url: urls.get(c.frame_path ?? "") ?? null, drawing_url: urls.get(c.drawing_path ?? "") ?? null };
  });
}
