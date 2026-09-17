import { NextResponse } from "next/server";
import { assignmentAllowanceError, planFor } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["homework", "quiz", "exam", "notes"];

/** Creates an assignment shell; the browser then uploads its page images and registers them. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { title?: string; kind?: string; courseId?: string | null };
  const { plan } = await planFor(user.id);
  const overLimit = await assignmentAllowanceError(user.id, plan);
  if (overLimit) return NextResponse.json({ error: overLimit, upgrade: plan !== "pro" }, { status: 429 });

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      course_id: body.courseId || null,
      title: (body.title || "Assignment").slice(0, 160),
      kind: KINDS.includes(body.kind ?? "") ? body.kind : "homework",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignmentId: data.id });
}
