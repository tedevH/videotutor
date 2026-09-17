import { after, NextResponse } from "next/server";
import { ingestVideo } from "@/lib/ingest";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fetchSourceMeta, resolveVideoUrl } from "@/lib/video-sources";

export const maxDuration = 300;

/** Adds a video to the user's library, starting analysis if nobody has added it before. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { url } = (await request.json()) as { url?: string };
  const resolved = resolveVideoUrl(url ?? "");
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const db = createAdminClient();
  const { data: existing } = await db.from("videos").select("id, index_status").eq("id", resolved.id).maybeSingle();

  if (!existing) {
    const meta = await fetchSourceMeta(resolved).catch(() => null);
    if (!meta) return NextResponse.json({ error: "Video not found, private, or not embeddable" }, { status: 404 });
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
  if (status === "pending" || status === "failed") after(() => ingestVideo(resolved.id));

  const { data: session, error } = await supabase
    .from("sessions")
    .upsert({ user_id: user.id, video_id: resolved.id, updated_at: new Date().toISOString() }, { onConflict: "user_id,video_id" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: session.id });
}
