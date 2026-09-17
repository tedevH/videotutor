import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Saves the student's pen work on one page so it's still there when they come back. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { pageNumber?: number; strokes?: unknown };
  const pageNumber = Number(body.pageNumber);
  if (!Number.isFinite(pageNumber) || !Array.isArray(body.strokes)) return NextResponse.json({ error: "Invalid annotation" }, { status: 400 });
  if (JSON.stringify(body.strokes).length > 400_000) return NextResponse.json({ error: "That's a lot of ink: clear some and try again." }, { status: 413 });

  const { error } = await supabase
    .from("assignment_annotations")
    .upsert({ assignment_id: id, user_id: user.id, page_number: pageNumber, strokes: body.strokes, updated_at: new Date().toISOString() }, { onConflict: "assignment_id,page_number" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
