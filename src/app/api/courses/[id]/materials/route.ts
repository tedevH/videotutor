import { after, NextResponse } from "next/server";
import { processMaterial } from "@/lib/courses/build";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const KINDS = ["syllabus", "slides", "notes", "textbook", "homework", "exam", "other"];
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"];

/**
 * Registers a file the browser already uploaded to the private `materials` bucket, then analyzes it
 * in the background. (Uploading directly avoids serverless request-size limits.)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json()) as { storagePath?: string; kind?: string; title?: string; mimeType?: string };
  if (!body.storagePath?.startsWith(`${user.id}/`)) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  if (!TYPES.includes(body.mimeType ?? "")) {
    return NextResponse.json({ error: "Upload a PDF, image, or text file (export slides to PDF first)." }, { status: 400 });
  }

  const { data: course } = await supabase.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      course_id: courseId,
      user_id: user.id,
      kind: KINDS.includes(body.kind ?? "") ? body.kind : "other",
      title: (body.title ?? "Material").slice(0, 160),
      storage_path: body.storagePath,
      mime_type: body.mimeType,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  after(() => processMaterial(user.id, data.id));
  return NextResponse.json({ materialId: data.id });
}
