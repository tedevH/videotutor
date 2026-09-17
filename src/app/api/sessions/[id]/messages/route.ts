import { NextResponse } from "next/server";
import { signFrameUrls, uploadFrame } from "@/lib/frames";
import { mediaForVideo, VIDEO_MEDIA_COLUMNS, type VideoRow } from "@/lib/media";
import { questionsPerDay } from "@/lib/plans";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { runTutor } from "@/lib/tutor/pipeline";
import { summarizeHistory, type ChunkRow } from "@/lib/tutor/prompt";

// Hard questions run a code-checked solve pass, which can take a minute or more.
export const maxDuration = 300;

const HISTORY_MESSAGES = 8;
const MAX_FRAME_BASE64 = 2_000_000;
const MAX_CAPTION_CHARS = 8000;
const MAX_RECENT_FRAMES = 6;
const MAX_RECENT_FRAME_BASE64 = 250_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as {
    text?: string;
    timestamp?: number;
    frame?: string | null;
    captions?: string;
    recentFrames?: string[];
  };
  const text = body.text?.trim();
  const timestamp = Math.max(0, body.timestamp ?? 0);
  const frame = typeof body.frame === "string" && body.frame.length < MAX_FRAME_BASE64 ? body.frame : null;
  if (!text) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  // RLS guarantees this only returns the user's own session.
  const { data: session } = await supabase
    .from("sessions")
    .select(`id, video_id, videos(title, channel, summary, index_status, ${VIDEO_MEDIA_COLUMNS})`)
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const db = createAdminClient();
  const [{ data: profile }, { count: usedToday }] = await Promise.all([
    supabase.from("profiles").select("school_level, plan").eq("id", user.id).single(),
    db
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "tutor")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
  ]);
  const limit = questionsPerDay(profile?.plan);
  if ((usedToday ?? 0) >= limit) {
    return NextResponse.json(
      {
        error:
          profile?.plan === "pro"
            ? `You've asked ${limit} questions today. The limit resets in 24 hours.`
            : `You've used today's ${limit} free questions. Upgrade to Pro for ${questionsPerDay("pro")} a day.`,
        upgrade: profile?.plan !== "pro",
      },
      { status: 429 },
    );
  }

  // Read history before inserting the new question so it isn't counted as "earlier".
  const [framePath, { data: history }, { data: chunks }] = await Promise.all([
    frame ? uploadFrame(user.id, sessionId, frame) : null,
    supabase
      .from("messages")
      .select("role, video_timestamp, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES),
    supabase
      .from("video_chunks")
      .select("start_seconds, end_seconds, transcript, visual, on_screen_text, concepts")
      .eq("video_id", session.video_id)
      .order("start_seconds"),
  ]);

  const { data: userMsg, error: insertError } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      role: "user",
      video_timestamp: Math.floor(timestamp),
      content: framePath ? { text, frame_path: framePath } : { text },
    })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const videoRow = session.videos as unknown as VideoRow;
  const media = await mediaForVideo(videoRow).catch((err) => {
    console.error("video media unavailable", err);
    return null;
  });
  // Browser-side context, used when Gemini can't watch the video itself.
  const live = {
    captions: typeof body.captions === "string" ? body.captions.slice(-MAX_CAPTION_CHARS) : "",
    recentFrames: Array.isArray(body.recentFrames)
      ? body.recentFrames.filter((f) => typeof f === "string" && f.length < MAX_RECENT_FRAME_BASE64).slice(-MAX_RECENT_FRAMES)
      : [],
  };

  const { response, model, usage } = await runTutor({
    media,
    live: media ? null : live,
    timestamp,
    question: text,
    frameJpeg: frame,
    video: session.videos as unknown as { title: string | null; channel: string | null; summary: string | null; index_status: string },
    chunks: (chunks ?? []) as ChunkRow[],
    studentLevel: profile?.school_level ?? "college",
    conversation: summarizeHistory((history ?? []).reverse()),
  });

  const [{ data: assistantMsg }] = await Promise.all([
    supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        video_timestamp: Math.floor(timestamp),
        content: framePath ? { ...response, frame_path: framePath } : response,
      })
      .select()
      .single(),
    supabase
      .from("sessions")
      .update({ last_position: Math.floor(timestamp), updated_at: new Date().toISOString() })
      .eq("id", sessionId),
    db.from("usage_events").insert({
      user_id: user.id,
      kind: "tutor",
      model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    }),
  ]);

  return NextResponse.json({ messages: await signFrameUrls([userMsg, assistantMsg]) });
}
