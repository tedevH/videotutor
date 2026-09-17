import { lectureAllowanceError, planFor } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchSourceMeta, resolveVideoUrl } from "@/lib/video-sources";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adds a video to a user's library (creating the shared video row if new) and returns their session.
 * `needsIngest` tells the caller to start analysis in the background.
 */
export async function addVideo(
  supabase: SupabaseClient,
  userId: string,
  url: string,
  opts: { courseId?: string | null } = {},
): Promise<{ error: string; status: number } | { sessionId: string; videoId: string; needsIngest: boolean }> {
  const resolved = resolveVideoUrl(url);
  if ("error" in resolved) return { error: resolved.error, status: 400 };

  const db = createAdminClient();
  const { data: alreadyAdded } = await db.from("sessions").select("id").eq("user_id", userId).eq("video_id", resolved.id).maybeSingle();
  if (!alreadyAdded) {
    const { plan } = await planFor(userId);
    const limitError = await lectureAllowanceError(userId, plan);
    if (limitError) return { error: limitError, status: 402 };
  }
  const { data: existing } = await db.from("videos").select("id, index_status").eq("id", resolved.id).maybeSingle();
  if (!existing) {
    const meta = await fetchSourceMeta(resolved).catch(() => null);
    if (!meta) return { error: "Video not found, private, or not embeddable", status: 404 };
    await db.from("videos").upsert(
      {
        id: resolved.id,
        provider: resolved.provider,
        source_url: resolved.sourceUrl,
        ...meta,
        // Vimeo can't be analyzed ahead of time; the tutor learns from playback instead.
        index_status: resolved.provider === "vimeo" ? "live" : "pending",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }
  const status = existing?.index_status ?? (resolved.provider === "vimeo" ? "live" : "pending");

  const { data: session, error } = await supabase
    .from("sessions")
    .upsert(
      { user_id: userId, video_id: resolved.id, updated_at: new Date().toISOString(), ...(opts.courseId && { course_id: opts.courseId }) },
      { onConflict: "user_id,video_id" },
    )
    .select("id")
    .single();
  if (error) return { error: error.message, status: 500 };

  return { sessionId: session.id, videoId: resolved.id, needsIngest: status === "pending" || status === "failed" };
}
