import { after, NextResponse } from "next/server";
import { lastTutorReply, learnFromTurn } from "@/lib/brain/observe";
import { studentModelSummary } from "@/lib/brain/profile";
import { signFrameUrls, uploadFrame } from "@/lib/frames";
import { qualifyReferral } from "@/lib/referrals";
import { refusalResponse, SAFETY_REFUSAL, SafetyBlockedError, screenQuestion } from "@/lib/ai/guard";
import { mediaForVideo, VIDEO_MEDIA_COLUMNS, type VideoRow } from "@/lib/media";
import { planFor } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { runTutor } from "@/lib/tutor/pipeline";
import { describeBoard, summarizeHistory, type ChunkRow } from "@/lib/tutor/prompt";

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
    drawing?: string | null;
    page?: number;
  };
  const text = body.text?.trim();
  const timestamp = Math.max(0, body.timestamp ?? 0);
  const frame = typeof body.frame === "string" && body.frame.length < MAX_FRAME_BASE64 ? body.frame : null;
  const drawing = typeof body.drawing === "string" && body.drawing.length < MAX_FRAME_BASE64 ? body.drawing : null;
  if (!text && !drawing) return NextResponse.json({ error: "Ask a question" }, { status: 400 });
  const question = text || "Here's what I drew. Is this right?";

  // RLS guarantees this only returns the user's own session.
  const { data: session } = await supabase
    .from("sessions")
    .select(`id, video_id, mode, course_id, assignment_id, videos(title, channel, summary, index_status, ${VIDEO_MEDIA_COLUMNS})`)
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Obvious attacks (asking for keys, prompt injection, harmful how-tos) never reach the model
  // and don't use up one of the student's questions.
  const verdict = screenQuestion(question);
  if (!verdict.ok) {
    console.warn("guard declined a question", { userId: user.id, sessionId, reason: verdict.reason });
    return declined(supabase, sessionId, question, verdict.reply);
  }

  const videoRow = session.videos as unknown as VideoRow | null;
  // Homework sessions: the page the student is on, and the problems printed on it.
  const worksheet = session.assignment_id ? await worksheetContext(supabase, session.assignment_id, Math.max(1, Math.floor(body.page ?? 1))) : null;
  const db = createAdminClient();
  const monthStart = new Date();
  const startOfMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1)).toISOString();
  const [entitlement, { count: usedToday }, { count: usedThisMonth }] = await Promise.all([
    planFor(user.id),
    db
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "tutor")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    db.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", "tutor").gte("created_at", startOfMonth),
  ]);
  const monthlyLimit = entitlement.limits.tutorQuestionsPerMonth;
  if (entitlement.isGuest && (usedThisMonth ?? 0) >= monthlyLimit) {
    return NextResponse.json(
      {
        error: `That's ${monthlyLimit} questions on a guest account. Create a free account to keep this conversation and get ${PLANS.free.limits.tutorQuestionsPerMonth} questions a month.`,
        signup: true,
      },
      { status: 429 },
    );
  }
  if ((usedThisMonth ?? 0) >= monthlyLimit) {
    return NextResponse.json(
      {
        error:
          entitlement.plan === "pro"
            ? `You've asked ${monthlyLimit} questions this month, which is the Pro ceiling. It resets on the 1st — email tedevh8@gmail.com if you need more.`
            : `You've used this month's ${monthlyLimit} questions. ${entitlement.plan === "free" ? "Plus includes 600 a month, or invite 2 friends to unlock 14 days of Plus." : "Pro includes 1,500 a month."} Your allowance resets on the 1st.`,
        upgrade: entitlement.plan !== "pro",
      },
      { status: 429 },
    );
  }
  const limit = entitlement.limits.tutorQuestionsPerDay;
  if ((usedToday ?? 0) >= limit) {
    return NextResponse.json(
      {
        error:
          entitlement.plan === "free"
            ? `You've used today's ${limit} free questions. Plus includes ${PLANS.plus.limits.tutorQuestionsPerDay} a day, or invite 2 friends to unlock 14 days of Plus.`
            : `You've asked ${limit} questions today. The limit resets in 24 hours.`,
        upgrade: entitlement.plan !== "pro",
      },
      { status: 429 },
    );
  }

  // Read history before inserting the new question so it isn't counted as "earlier".
  const [framePath, drawingPath, previousTutorReply, { data: history }, { data: chunks }] = await Promise.all([
    frame ? uploadFrame(user.id, sessionId, frame) : null,
    drawing ? uploadFrame(user.id, sessionId, drawing, "image/png") : null,
    lastTutorReply(sessionId),
    supabase
      .from("messages")
      .select("role, video_timestamp, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES),
    supabase
      .from("video_chunks")
      .select("start_seconds, end_seconds, transcript, visual, on_screen_text, concepts")
      .eq("video_id", session.video_id ?? "")
      .order("start_seconds"),
  ]);

  const { data: userMsg, error: insertError } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      role: "user",
      video_timestamp: videoRow ? Math.floor(timestamp) : null,
      content: { text: question, ...(framePath && { frame_path: framePath }), ...(drawingPath && { drawing_path: drawingPath }) },
    })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Whiteboard sessions have no video.
  const media = videoRow
    ? await mediaForVideo(videoRow).catch((err) => {
        console.error("video media unavailable", err);
        return null;
      })
    : null;
  // Browser-side context, used when Gemini can't watch the video itself.
  const live = {
    captions: typeof body.captions === "string" ? body.captions.slice(-MAX_CAPTION_CHARS) : "",
    recentFrames: Array.isArray(body.recentFrames)
      ? body.recentFrames.filter((f) => typeof f === "string" && f.length < MAX_RECENT_FRAME_BASE64).slice(-MAX_RECENT_FRAMES)
      : [],
  };

  let run: Awaited<ReturnType<typeof runTutor>>;
  try {
    run = await runTutor({
    media,
    live: media || !videoRow ? null : live,
    timestamp,
    question,
    frameJpeg: frame,
    drawingPng: drawing,
    video: (session.videos as unknown as { title: string | null; channel: string | null; summary: string | null; index_status: string } | null) ?? {
      title: worksheet?.title ?? "Whiteboard session",
      channel: null,
      summary: null,
      index_status: "ready",
    },
    chunks: (chunks ?? []) as ChunkRow[],
    studentLevel: entitlement.schoolLevel,
    verifiedMath: entitlement.limits.verifiedMath,
    tutorModel: entitlement.limits.bestModels ? process.env.GEMINI_PRO_TUTOR_MODEL || "gemini-3.5-flash" : undefined,
    conversation: summarizeHistory((history ?? []).reverse()),
    // A quiz or exam is always guided: "just explain" would hand over the answers.
    mode: worksheet?.graded ? "socratic" : session.mode === "direct" ? "direct" : "socratic",
    surface: worksheet ? "worksheet" : videoRow ? "video" : "whiteboard",
    boardState: videoRow || worksheet ? null : describeBoard((history ?? []) as { role: string; content: unknown }[]),
    worksheet: worksheet?.text ?? null,
    graded: worksheet?.graded ?? false,
    studentModel: (subject) => studentModelSummary(user.id, subject),
    // Answering Lumo's question about the same moment: reuse what that exchange already worked out.
    followUp:
      previousTutorReply?.awaiting_student && previousTutorReply.context_cache && Math.abs(previousTutorReply.context_cache.timestamp - timestamp) < 5
        ? previousTutorReply.context_cache
        : null,
    });
  } catch (err) {
    if (!(err instanceof SafetyBlockedError)) throw err;
    console.warn("safety filter declined a question", { userId: user.id, sessionId, reason: err.message });
    const { data: refusal } = await supabase
      .from("messages")
      .insert({ session_id: sessionId, role: "assistant", video_timestamp: videoRow ? Math.floor(timestamp) : null, content: refusalResponse(SAFETY_REFUSAL) })
      .select()
      .single();
    return NextResponse.json({ messages: await signFrameUrls([userMsg, refusal]) });
  }
  const { response, model, usage } = run;

  // Update the student model after responding; it doesn't need to slow the answer down.
  after(() =>
    learnFromTurn({ userId: user.id, sessionId, source: videoRow ? "video" : "board", response, previousTutorReply, courseId: session.course_id }),
  );

  const [{ data: assistantMsg }] = await Promise.all([
    supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        video_timestamp: videoRow ? Math.floor(timestamp) : null,
        content: framePath ? { ...response, frame_path: framePath } : response,
      })
      .select()
      .single(),
    supabase
      .from("sessions")
      .update({ last_position: Math.floor(timestamp), updated_at: new Date().toISOString() })
      .eq("id", sessionId),
    // An invite pays out once the friend actually uses Lumo, not merely signs up.
    qualifyReferral(user.id).catch((err) => console.error("referral qualify failed", err)),
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

/** The assignment page the student is looking at: its printed problems and whether it's graded. */
async function worksheetContext(supabase: Awaited<ReturnType<typeof createClient>>, assignmentId: string, page: number) {
  const [{ data: assignment }, { data: problems }, { data: pageRow }] = await Promise.all([
    supabase.from("assignments").select("title, kind").eq("id", assignmentId).maybeSingle(),
    supabase.from("assignment_problems").select("label, prompt, status").eq("assignment_id", assignmentId).eq("page_number", page).order("position"),
    supabase.from("assignment_pages").select("text").eq("assignment_id", assignmentId).eq("page_number", page).maybeSingle(),
  ]);
  if (!assignment) return null;

  const lines = (problems ?? []).map((p) => `- ${p.label} (${p.status}): ${p.prompt}`);
  const text = [
    `assignment: ${assignment.title} (${assignment.kind}), page ${page}`,
    lines.length ? `problems on this page:\n${lines.join("\n")}` : "",
    pageRow?.text ? `printed on the page:\n${pageRow.text.slice(0, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { title: assignment.title, graded: assignment.kind === "quiz" || assignment.kind === "exam", text };
}

/** Records a declined question and Lumo's refusal, without calling the model or counting usage. */
async function declined(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string, question: string, reply: string) {
  const { data: userMsg, error } = await supabase.from("messages").insert({ session_id: sessionId, role: "user", video_timestamp: null, content: { text: question } }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, role: "assistant", video_timestamp: null, content: refusalResponse(reply) })
    .select()
    .single();
  return NextResponse.json({ messages: await signFrameUrls([userMsg, assistantMsg]) });
}
