import { createAdminClient } from "@/lib/supabase/server";
import type { StoredMessage } from "@/lib/tutor/schema";

const BUCKET = "frames";
const URL_TTL_SECONDS = 60 * 60 * 6;

/** Stores the student's paused frame. Returns null on failure so the question still gets answered. */
export async function uploadFrame(userId: string, sessionId: string, base64Jpeg: string) {
  const path = `${userId}/${sessionId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, Buffer.from(base64Jpeg, "base64"), { contentType: "image/jpeg" });
  if (error) {
    console.error("frame upload failed", error.message);
    return null;
  }
  return path;
}

/** Adds short-lived signed URLs for any message that references a stored frame. */
export async function signFrameUrls<T extends Pick<StoredMessage, "content">>(messages: T[]) {
  const paths = [
    ...new Set(
      messages.map((m) => (m.content as { frame_path?: string }).frame_path).filter((p): p is string => !!p),
    ),
  ];
  if (!paths.length) return messages.map((m) => ({ ...m, frame_url: null }));

  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SECONDS);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return messages.map((m) => ({
    ...m,
    frame_url: urls.get((m.content as { frame_path?: string }).frame_path ?? "") ?? null,
  }));
}
