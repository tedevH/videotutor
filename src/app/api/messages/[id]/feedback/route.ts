import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { rating } = (await request.json()) as { rating?: number };
  if (rating !== 1 && rating !== -1) return NextResponse.json({ error: "rating must be 1 or -1" }, { status: 400 });

  const { error } = await supabase
    .from("feedback")
    .upsert({ message_id: id, user_id: user.id, rating }, { onConflict: "message_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
