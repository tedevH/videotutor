import { after, NextResponse } from "next/server";
import { processAssignment } from "@/lib/homework/build";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * Registers the page images the browser rendered from the upload (PDF pages or photos),
 * then reads the problems off them in the background.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as {
    filePath?: string;
    pages?: { pageNumber: number; imagePath: string; width?: number; height?: number }[];
  };
  const pages = (body.pages ?? []).filter((p) => p.imagePath?.startsWith(`${user.id}/`) && Number.isFinite(p.pageNumber));
  if (!pages.length) return NextResponse.json({ error: "No pages to add" }, { status: 400 });

  // RLS already limits this to the student's own assignment; page rows are then written server-side.
  const { data: assignment } = await supabase.from("assignments").select("id").eq("id", id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const { error } = await createAdminClient().from("assignment_pages").upsert(
    pages.map((p) => ({
      assignment_id: id,
      user_id: user.id,
      page_number: p.pageNumber,
      image_path: p.imagePath,
      width: p.width ?? null,
      height: p.height ?? null,
    })),
    { onConflict: "assignment_id,page_number" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("assignments")
    .update({ page_count: pages.length, status: "processing", ...(body.filePath?.startsWith(`${user.id}/`) && { file_path: body.filePath }) })
    .eq("id", id);

  after(() => processAssignment(user.id, id));
  return NextResponse.json({ ok: true, pages: pages.length });
}
