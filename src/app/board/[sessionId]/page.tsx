import { notFound } from "next/navigation";
import { signFrameUrls } from "@/lib/frames";
import { createClient } from "@/lib/supabase/server";
import type { StoredMessage } from "@/lib/tutor/schema";
import { BoardView } from "./board-view";

export const metadata = { title: "Whiteboard · LumoTutor" };

export default async function BoardPage({ params }: PageProps<"/board/[sessionId]">) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("id, mode").eq("id", sessionId).maybeSingle();
  if (!session) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, video_timestamp, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at");

  return (
    <BoardView
      sessionId={session.id}
      initialMode={session.mode === "direct" ? "direct" : "socratic"}
      initialMessages={(await signFrameUrls((messages ?? []) as StoredMessage[])) as StoredMessage[]}
    />
  );
}
