import { notFound } from "next/navigation";
import { signFrameUrls } from "@/lib/frames";
import { createClient } from "@/lib/supabase/server";
import type { StoredMessage } from "@/lib/tutor/schema";
import { WatchView } from "./watch-view";

export default async function WatchPage({ params }: PageProps<"/watch/[sessionId]">) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, video_id, last_position, videos(title, channel, index_status, provider, source_url)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, video_timestamp, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at");

  const video = session.videos as unknown as {
    title: string | null;
    channel: string | null;
    index_status: string;
    provider: "youtube" | "vimeo" | "file";
    source_url: string | null;
  };

  return (
    <WatchView
      sessionId={session.id}
      videoId={session.video_id}
      provider={video.provider}
      sourceUrl={video.source_url ?? `https://www.youtube.com/watch?v=${session.video_id}`}
      title={video.title}
      channel={video.channel}
      initialStatus={video.index_status}
      startAt={session.last_position}
      initialMessages={(await signFrameUrls((messages ?? []) as StoredMessage[])) as StoredMessage[]}
    />
  );
}
