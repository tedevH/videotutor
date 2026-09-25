import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Opens a whiteboard for the current visitor, guest or not. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { data, error } = await supabase.from("sessions").insert({ user_id: user.id, video_id: null }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessionId: data.id });
}
