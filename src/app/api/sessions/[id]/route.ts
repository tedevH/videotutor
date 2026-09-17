import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Saves where the student is in the video so the library can resume there. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { position } = (await request.json()) as { position?: number };
  if (typeof position !== "number") return NextResponse.json({ error: "position required" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ last_position: Math.floor(position), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
