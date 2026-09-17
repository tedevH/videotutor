import { after, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fetchVideoMeta, parseYouTubeId } from "@/lib/youtube";
import { ingestVideo } from "@/lib/ingest";

export const maxDuration = 300;

/** Adds a video to the user's library, starting indexing if nobody has watched it before. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { url } = (await request.json()) as { url?: string };
  const videoId = url ? parseYouTubeId(url) : null;
  if (!videoId) return NextResponse.json({ error: "That doesn't look like a YouTube link" }, { status: 400 });

  const db = createAdminClient();
  const { data: existing } = await db.from("videos").select("id, index_status").eq("id", videoId).maybeSingle();

  if (!existing) {
    const meta = await fetchVideoMeta(videoId);
    if (!meta) {
      return NextResponse.json({ error: "Video not found, private, or not embeddable" }, { status: 404 });
    }
    await db.from("videos").upsert({ id: videoId, ...meta }, { onConflict: "id", ignoreDuplicates: true });
  }

  if (!existing || existing.index_status === "failed") after(() => ingestVideo(videoId));

  const { data: session, error } = await supabase
    .from("sessions")
    .upsert({ user_id: user.id, video_id: videoId, updated_at: new Date().toISOString() }, { onConflict: "user_id,video_id" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: session.id });
}
