import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { askTutor } from "@/lib/ai/tutor";
import { buildContext, SYSTEM_PROMPT, type ChunkRow } from "@/lib/tutor/prompt";
import type { TutorResponse, UserContent } from "@/lib/tutor/schema";

export const maxDuration = 120;

const FREE_DAILY_QUESTIONS = 50;
const WINDOW_BEFORE = 90;
const WINDOW_AFTER = 15;
const HISTORY_MESSAGES = 8;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { text?: string; timestamp?: number };
  const text = body.text?.trim();
  const timestamp = Math.max(0, body.timestamp ?? 0);
  if (!text) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  // RLS guarantees this only returns the user's own session.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, video_id, videos(title, summary, index_status)")
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

  const { data: userMsg, error: insertError } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, role: "user", video_timestamp: Math.floor(timestamp), content: { text } })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const [{ data: nearby }, { data: history }] = await Promise.all([
    supabase
      .from("video_chunks")
      .select("start_seconds, end_seconds, transcript, visual, on_screen_text, concepts")
      .eq("video_id", session.video_id)
      .lt("start_seconds", timestamp + WINDOW_AFTER)
      .gt("end_seconds", timestamp - WINDOW_BEFORE)
      .order("start_seconds"),
    supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .neq("id", userMsg.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES),
  ]);

  const video = session.videos as unknown as { title: string | null; summary: string | null; index_status: string };
  const context = buildContext({
    title: video.title,
    summary: video.summary,
    level: profile?.school_level ?? "college",
    timestamp,
    nearby: (nearby ?? []) as ChunkRow[],
    hasIndex: video.index_status === "ready",
  });

  const { response, model, inputTokens, outputTokens } = await askTutor(SYSTEM_PROMPT, [
    ...(history ?? []).reverse().map((m) =>
      m.role === "user"
        ? { role: "user" as const, text: (m.content as UserContent).text }
        : { role: "model" as const, text: JSON.stringify(m.content as TutorResponse) },
    ),
    { role: "user", text: `${context}\n\nSTUDENT'S QUESTION: ${text}` },
  ]);

  const [{ data: assistantMsg }] = await Promise.all([
    supabase
      .from("messages")
      .insert({ session_id: sessionId, role: "assistant", video_timestamp: Math.floor(timestamp), content: response })
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
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    }),
  ]);

  return NextResponse.json({ messages: [userMsg, assistantMsg] });
}
