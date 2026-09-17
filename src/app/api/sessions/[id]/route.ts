import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Updates a session: playback position, tutoring mode (socratic/direct), or course. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { position?: number; mode?: string; courseId?: string | null };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.position === "number") update.last_position = Math.floor(body.position);
  if (body.mode === "socratic" || body.mode === "direct") update.mode = body.mode;
  if (body.courseId !== undefined) update.course_id = body.courseId;
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
