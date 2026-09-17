import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const TABLES = [
  "profiles",
  "sessions",
  "messages",
  "videos",
  "courses",
  "course_materials",
  "concepts",
  "mastery",
  "misconceptions",
  "learning_events",
  "practice_items",
  "practice_attempts",
  "assignments",
  "assignment_problems",
  "assignment_annotations",
  "usage_events",
] as const;

/** Everything we hold about this student, as one JSON file they can download. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const db = createAdminClient();
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
  };
  for (const table of TABLES) {
    // messages belong to the student through their session, not by a user_id column.
    const query = table === "messages" ? db.from(table).select("*, sessions!inner(user_id)").eq("sessions.user_id", user.id) : db.from(table).select("*").eq("user_id", user.id);
    const { data: rows, error } = await query;
    data[table] = error ? { error: error.message } : rows;
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lumotutor-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
