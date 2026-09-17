import { ensureConcept } from "@/lib/brain/store";
import { createAdminClient } from "@/lib/supabase/server";
import { extractWorksheet } from "./extract";

export const HOMEWORK_BUCKET = "homework";
const MAX_PAGES = 12;
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

/**
 * Reads an uploaded assignment's pages into a problem list tied to concepts.
 * Never throws: failures are stored on the assignment so the page can show them.
 */
export async function processAssignment(userId: string, assignmentId: string) {
  const db = createAdminClient();
  const { data: assignment } = await db.from("assignments").select("id, kind, title, course_id").eq("id", assignmentId).eq("user_id", userId).single();
  if (!assignment) return;
  await db.from("assignments").update({ status: "processing", error: null }).eq("id", assignmentId);

  try {
    const { data: pageRows } = await db
      .from("assignment_pages")
      .select("page_number, image_path")
      .eq("assignment_id", assignmentId)
      .order("page_number")
      .limit(MAX_PAGES);
    if (!pageRows?.length) throw new Error("No pages were uploaded");

    const pages = [];
    for (const row of pageRows) {
      const { data: blob, error } = await db.storage.from(HOMEWORK_BUCKET).download(row.image_path);
      if (error || !blob) throw new Error(error?.message ?? "Couldn't read the uploaded pages");
      if (blob.size > MAX_INLINE_BYTES) throw new Error("A page image is too large to read");
      pages.push({ page: row.page_number, data: Buffer.from(await blob.arrayBuffer()), mimeType: blob.type || "image/png" });
    }

    const { data: existing } = await db.from("concepts").select("name").eq("user_id", userId).limit(200);
    const extraction = await extractWorksheet({
      kind: assignment.kind,
      title: assignment.title,
      pages,
      existingConcepts: (existing ?? []).map((c) => c.name),
      userId,
    });

    for (const p of extraction.page_text) {
      await db.from("assignment_pages").update({ text: p.text.slice(0, 20_000) }).eq("assignment_id", assignmentId).eq("page_number", p.page);
    }

    // Re-extraction replaces the problem list, but keeps nothing stale behind.
    await db.from("assignment_problems").delete().eq("assignment_id", assignmentId);
    let position = 0;
    for (const problem of extraction.problems.slice(0, 100)) {
      const concept = problem.concept.trim()
        ? await ensureConcept(userId, { name: problem.concept.trim(), subject: extraction.subject || null, courseId: assignment.course_id }).catch(() => null)
        : null;
      await db.from("assignment_problems").insert({
        assignment_id: assignmentId,
        user_id: userId,
        page_number: problem.page || 1,
        label: problem.label.slice(0, 20),
        prompt: problem.prompt.slice(0, 4000),
        concept_id: concept?.id ?? null,
        position: position++,
      });
    }

    await db
      .from("assignments")
      .update({ status: "ready", title: assignment.title || extraction.title || "Assignment", updated_at: new Date().toISOString() })
      .eq("id", assignmentId);
  } catch (err) {
    console.error("assignment processing failed", assignmentId, err);
    await db
      .from("assignments")
      .update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "Processing failed" })
      .eq("id", assignmentId);
  }
}
