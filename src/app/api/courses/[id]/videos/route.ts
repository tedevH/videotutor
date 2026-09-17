import { after, NextResponse } from "next/server";
import { linkVideoToCourse } from "@/lib/courses/build";
import { createClient } from "@/lib/supabase/server";
import { addVideo } from "@/lib/videos";

export const maxDuration = 300;

/** Adds a lecture video to a course and maps which course concepts it teaches, and when. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const { url } = (await request.json()) as { url?: string };
  const result = await addVideo(supabase, user.id, url ?? "", { courseId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { data: video } = await supabase.from("videos").select("title, provider").eq("id", result.videoId).single();
  await supabase.from("course_materials").insert({
    course_id: courseId,
    user_id: user.id,
    kind: "video",
    title: video?.title ?? "Lecture video",
    video_id: result.videoId,
    status: video?.provider === "vimeo" ? "ready" : "processing",
  });
  if (video?.provider !== "vimeo") after(() => linkVideoToCourse(user.id, courseId, result.videoId));
  return NextResponse.json({ sessionId: result.sessionId });
}
