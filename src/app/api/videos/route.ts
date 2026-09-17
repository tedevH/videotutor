import { after, NextResponse } from "next/server";
import { ingestVideo } from "@/lib/ingest";
import { createClient } from "@/lib/supabase/server";
import { addVideo } from "@/lib/videos";

export const maxDuration = 300;

/** Adds a video to the user's library, starting analysis if nobody has added it before. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { url } = (await request.json()) as { url?: string };
  const result = await addVideo(supabase, user.id, url ?? "");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.needsIngest) after(() => ingestVideo(result.videoId));
  return NextResponse.json({ sessionId: result.sessionId });
}
