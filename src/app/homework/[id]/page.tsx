import { notFound, redirect } from "next/navigation";
import { signFrameUrls } from "@/lib/frames";
import { HOMEWORK_BUCKET } from "@/lib/homework/build";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { StoredMessage } from "@/lib/tutor/schema";
import { HomeworkView } from "./homework-view";

export const metadata = { title: "Homework" };

const PAGE_URL_TTL = 60 * 60 * 6;

export default async function AssignmentPage({ params }: PageProps<"/homework/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/homework/${id}`);

  const { data: assignment } = await supabase.from("assignments").select("id, title, kind, status, error, page_count").eq("id", id).maybeSingle();
  if (!assignment) notFound();

  const [{ data: pages }, { data: problems }, { data: annotations }] = await Promise.all([
    supabase.from("assignment_pages").select("page_number, image_path, width, height").eq("assignment_id", id).order("page_number"),
    supabase.from("assignment_problems").select("id, label, prompt, page_number, status, concept_id").eq("assignment_id", id).order("position"),
    supabase.from("assignment_annotations").select("page_number, strokes").eq("assignment_id", id),
  ]);

  const db = createAdminClient();
  const { data: signed } = await db.storage.from(HOMEWORK_BUCKET).createSignedUrls(
    (pages ?? []).map((p) => p.image_path),
    PAGE_URL_TTL,
  );
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  // One tutoring session per assignment, so the conversation picks up where it left off.
  let { data: session } = await supabase.from("sessions").select("id, mode").eq("assignment_id", id).maybeSingle();
  if (!session) {
    const { data: created, error } = await supabase.from("sessions").insert({ user_id: user.id, video_id: null, assignment_id: id }).select("id, mode").single();
    if (error || !created) throw new Error(error?.message ?? "Couldn't start a homework session");
    session = created;
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, video_timestamp, content, created_at")
    .eq("session_id", session.id)
    .order("created_at");

  return (
    <HomeworkView
      assignment={{ id: assignment.id, title: assignment.title, kind: assignment.kind, status: assignment.status, error: assignment.error }}
      pages={(pages ?? []).map((p) => ({
        pageNumber: p.page_number,
        url: urlOf.get(p.image_path) ?? "",
        width: p.width ?? 1600,
        height: p.height ?? 2070,
      }))}
      problems={(problems ?? []).map((p) => ({ id: p.id, label: p.label, prompt: p.prompt, page: p.page_number, status: p.status }))}
      annotations={Object.fromEntries((annotations ?? []).map((a) => [a.page_number, a.strokes as { color: string; points: [number, number][] }[]]))}
      sessionId={session.id}
      initialMode={session.mode === "direct" ? "direct" : "socratic"}
      initialMessages={(await signFrameUrls((messages ?? []) as StoredMessage[])) as StoredMessage[]}
    />
  );
}
