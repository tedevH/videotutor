import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

const STATUSES = ["untouched", "working", "stuck", "solved"];

/** The student marks a problem's progress; the sidebar and study plan read it back. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { problemId?: string; status?: string };
  if (!body.problemId || !STATUSES.includes(body.status ?? "")) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  const { error } = await createAdminClient()
    .from("assignment_problems")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", body.problemId)
    .eq("assignment_id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
