import { redirect } from "next/navigation";
import { listConceptsWithMastery } from "@/lib/brain/store";
import { createClient } from "@/lib/supabase/server";
import { PracticeView } from "./practice-view";

export const metadata = { title: "Practice" };

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const { concept, course, topic, review } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/practice");

  const concepts = await listConceptsWithMastery(user.id).catch(() => []);
  const suggestions = concepts
    .filter((c) => c.level !== "mastered")
    .sort((a, b) => a.effective - b.effective)
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: c.name, subject: c.subject, level: c.level }));

  return (
    <PracticeView
      initialConceptId={typeof concept === "string" ? concept : null}
      courseId={typeof course === "string" ? course : null}
      initialTopic={typeof topic === "string" ? topic : ""}
      review={review === "1"}
      suggestions={suggestions}
    />
  );
}
