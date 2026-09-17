import { NextResponse } from "next/server";
import { signFrameUrls, uploadFrame } from "@/lib/frames";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { runTutor } from "@/lib/tutor/pipeline";
import { summarizeHistory, type ChunkRow } from "@/lib/tutor/prompt";

// Hard questions run a code-checked solve pass, which can take a minute or more.
export const maxDuration = 300;

const FREE_DAILY_QUESTIONS = 50;
const HISTORY_MESSAGES = 8;
const MAX_FRAME_BASE64 = 2_000_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { text?: string; timestamp?: number; frame?: string | null };
  const text = body.text?.trim();
  const timestamp = Math.max(0, body.timestamp ?? 0);
  const frame = typeof body.frame === "string" && body.frame.length < MAX_FRAME_BASE64 ? body.frame : null;
  if (!text) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  // RLS guarantees this only returns the user's own session.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, video_id, videos(title, channel, summary, index_status)")
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
  if (profile?.plan === "free" && (usedToday ?? 0) >= FREE_DAILY_QUESTIONS) {
    return NextResponse.json({ error: "You've hit today's free question limit." }, { status: 429 });
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

  const { response, model, usage } = await runTutor({
    videoId: session.video_id,
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
