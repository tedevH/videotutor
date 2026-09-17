import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Creates a tutoring session that isn't tied to a video (the standalone whiteboard). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { courseId?: string };
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, video_id: null, course_id: body.courseId ?? null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessionId: data.id });
}
