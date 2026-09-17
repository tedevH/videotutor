import { ensureConcept } from "@/lib/brain/store";
import { ingestVideo } from "@/lib/ingest";
import { createAdminClient } from "@/lib/supabase/server";
import { extractCourseStructure, mapVideoConcepts, type CourseExtraction } from "./extract";

const MATERIALS_BUCKET = "materials";
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

/** Processes an uploaded file into the course graph. Never throws; failures are stored on the material. */
export async function processMaterial(userId: string, materialId: string) {
  const db = createAdminClient();
  const { data: material } = await db
    .from("course_materials")
    .select("id, course_id, kind, title, storage_path, mime_type")
    .eq("id", materialId)
    .eq("user_id", userId)
    .single();
  if (!material?.storage_path) return;
  await db.from("course_materials").update({ status: "processing", error: null }).eq("id", materialId);

  try {
    const { data: blob, error } = await db.storage.from(MATERIALS_BUCKET).download(material.storage_path);
    if (error || !blob) throw new Error(error?.message ?? "Couldn't read the upload");
    if (blob.size > MAX_INLINE_BYTES) throw new Error("File is too large to analyze (limit 18 MB). Try splitting the PDF.");

    const mime = material.mime_type ?? blob.type;
    const file = mime.startsWith("text/") ? { text: await blob.text() } : { data: Buffer.from(await blob.arrayBuffer()), mimeType: mime };
    const { data: existing } = await db.from("concepts").select("name").eq("user_id", userId).eq("course_id", material.course_id);

    const extraction = await extractCourseStructure({
      kind: material.kind,
      title: material.title,
      file,
      existingConcepts: (existing ?? []).map((c) => c.name),
      today: new Date().toISOString().slice(0, 10),
    });
    await mergeIntoCourse(userId, material.course_id, extraction, { materialId });
    await db.from("course_materials").update({ status: "ready", summary: extraction.summary }).eq("id", materialId);
  } catch (err) {
    console.error("material processing failed", materialId, err);
    await db
      .from("course_materials")
      .update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "Processing failed" })
      .eq("id", materialId);
  }
}

export async function mergeIntoCourse(userId: string, courseId: string, extraction: CourseExtraction, source: { materialId?: string }) {
  const db = createAdminClient();
  const { data: course } = await db.from("courses").select("subject, exam_date").eq("id", courseId).single();
  const subject = course?.subject || extraction.subject || null;
  if (!course?.subject && extraction.subject) await db.from("courses").update({ subject: extraction.subject }).eq("id", courseId);

  // Earliest upcoming exam date, if the course doesn't have one yet.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = extraction.exam_dates.map((e) => e.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).sort()[0];
  if (upcoming && !course?.exam_date) await db.from("courses").update({ exam_date: upcoming }).eq("id", courseId);

  const { data: existingUnits } = await db.from("units").select("id, title, position").eq("course_id", courseId);
  let position = Math.max(0, ...(existingUnits ?? []).map((u) => u.position + 1));
  const conceptIds = new Map<string, string>();

  for (const unit of extraction.units) {
    let unitId = existingUnits?.find((u) => u.title.toLowerCase() === unit.title.toLowerCase())?.id;
    if (!unitId) {
      const { data } = await db.from("units").insert({ course_id: courseId, title: unit.title, summary: unit.summary, position: position++ }).select("id").single();
      unitId = data?.id;
    }
    for (const c of unit.concepts) {
      const concept = await ensureConcept(userId, {
        name: c.name,
        subject,
        description: c.description,
        courseId,
        unitId,
        examWeight: Math.min(3, Math.max(0.5, c.exam_weight)),
      });
      conceptIds.set(c.name.toLowerCase(), concept.id);
      if (source.materialId) {
        await db.from("concept_sources").insert({ concept_id: concept.id, material_id: source.materialId, page: c.page });
      }
      // Exams and homework raise how much a concept matters.
      if (c.exam_weight > 1) await db.from("concepts").update({ exam_weight: Math.min(3, c.exam_weight) }).eq("id", concept.id);
    }
  }

  // Prerequisites: link to known concepts; create basic ones the course assumes.
  for (const unit of extraction.units) {
    for (const c of unit.concepts) {
      const id = conceptIds.get(c.name.toLowerCase());
      if (!id) continue;
      for (const prereqName of c.prerequisites.slice(0, 6)) {
        const prereqId = conceptIds.get(prereqName.toLowerCase()) ?? (await ensureConcept(userId, { name: prereqName, subject, courseId })).id;
        if (prereqId !== id) {
          await db.from("concept_prerequisites").upsert({ concept_id: id, prerequisite_id: prereqId }, { onConflict: "concept_id,prerequisite_id", ignoreDuplicates: true });
        }
      }
    }
  }
}

/** Waits for a course video's notes, then links course concepts to the moments they're taught. */
export async function linkVideoToCourse(userId: string, courseId: string, videoId: string) {
  const db = createAdminClient();
  try {
    await ingestVideo(videoId);
    // Another request may be analyzing the same video; wait for it.
    for (let i = 0; i < 50; i++) {
      const { data: v } = await db.from("videos").select("index_status").eq("id", videoId).single();
      if (v?.index_status !== "processing" && v?.index_status !== "pending") break;
      await new Promise((r) => setTimeout(r, 5000));
    }
    const [{ data: chunks }, { data: concepts }, { data: course }] = await Promise.all([
      db.from("video_chunks").select("start_seconds, concepts, transcript").eq("video_id", videoId).order("start_seconds"),
      db.from("concepts").select("id, name").eq("user_id", userId).eq("course_id", courseId),
      db.from("courses").select("subject").eq("id", courseId).single(),
    ]);
    if (!chunks?.length) return;

    const mapping = await mapVideoConcepts({ concepts: (concepts ?? []).map((c) => c.name), chunks });
    const byName = new Map((concepts ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    for (const m of mapping) {
      const id = byName.get(m.concept.toLowerCase()) ?? (await ensureConcept(userId, { name: m.concept, subject: course?.subject, courseId })).id;
      await db.from("concept_sources").insert({ concept_id: id, video_id: videoId, start_seconds: Math.max(0, Math.floor(m.start_seconds)) });
    }
    await db.from("course_materials").update({ status: "ready" }).eq("course_id", courseId).eq("video_id", videoId);
  } catch (err) {
    console.error("linking video to course failed", videoId, err);
    await db
      .from("course_materials")
      .update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "Linking failed" })
      .eq("course_id", courseId)
      .eq("video_id", videoId);
  }
}
