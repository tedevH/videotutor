import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = (await request.json()) as { title?: string; examDate?: string | null; subject?: string };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title?.trim()) update.title = body.title.trim().slice(0, 120);
  if (body.subject !== undefined) update.subject = body.subject?.trim() || null;
  if (body.examDate !== undefined) update.exam_date = body.examDate && /^\d{4}-\d{2}-\d{2}$/.test(body.examDate) ? body.examDate : null;
  const { error } = await supabase.from("courses").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
