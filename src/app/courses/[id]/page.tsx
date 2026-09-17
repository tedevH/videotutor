import { notFound, redirect } from "next/navigation";
import { listConceptsWithMastery } from "@/lib/brain/store";
import { buildStudyPlan } from "@/lib/courses/plan";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { CourseView } from "./course-view";

export const metadata = { title: "Course" };

export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/courses/${id}`);

  const { data: course } = await supabase.from("courses").select("id, title, subject, exam_date").eq("id", id).maybeSingle();
  if (!course) notFound();

  const db = createAdminClient();
  const [{ data: materials }, { data: units }, concepts] = await Promise.all([
    supabase.from("course_materials").select("id, kind, title, status, error, video_id, created_at").eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("units").select("id, title, position, summary").eq("course_id", id).order("position"),
    listConceptsWithMastery(user.id, { courseId: id }),
  ]);
  const conceptIds = concepts.map((c) => c.id);
  const [{ data: prerequisites }, { data: sources }, { data: sessions }] = await Promise.all([
    conceptIds.length ? db.from("concept_prerequisites").select("concept_id, prerequisite_id").in("concept_id", conceptIds) : { data: [] },
    conceptIds.length ? db.from("concept_sources").select("concept_id, video_id, start_seconds, page, material_id").in("concept_id", conceptIds) : { data: [] },
    supabase.from("sessions").select("id, video_id").eq("course_id", id),
  ]);
  const unitOf = new Map<string, string | null>();
  const { data: conceptUnits } = conceptIds.length ? await db.from("concepts").select("id, unit_id").in("id", conceptIds) : { data: [] };
  for (const c of conceptUnits ?? []) unitOf.set(c.id, c.unit_id);

  const plan = buildStudyPlan(concepts, prerequisites ?? [], course.exam_date);
  const sessionByVideo = new Map((sessions ?? []).filter((s) => s.video_id).map((s) => [s.video_id as string, s.id]));

  return (
    <CourseView
      course={course}
      materials={materials ?? []}
      units={units ?? []}
      concepts={concepts.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        level: c.level,
        effective: c.effective,
        examWeight: c.exam_weight,
        unitId: unitOf.get(c.id) ?? null,
        prerequisites: (prerequisites ?? []).filter((p) => p.concept_id === c.id).map((p) => p.prerequisite_id),
        videoMoments: (sources ?? [])
          .filter((s) => s.concept_id === c.id && s.video_id && sessionByVideo.has(s.video_id))
          .map((s) => ({ sessionId: sessionByVideo.get(s.video_id!)!, seconds: s.start_seconds ?? 0 })),
      }))}
      plan={plan}
    />
  );
}
