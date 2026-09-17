import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { title?: string; subject?: string; examDate?: string };
  if (!body.title?.trim()) return NextResponse.json({ error: "Give the course a name" }, { status: 400 });
  const { data, error } = await supabase
    .from("courses")
    .insert({
      user_id: user.id,
      title: body.title.trim().slice(0, 120),
      subject: body.subject?.trim() || null,
      exam_date: /^\d{4}-\d{2}-\d{2}$/.test(body.examDate ?? "") ? body.examDate : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courseId: data.id });
}
