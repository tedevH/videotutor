import { effectivePlan } from "@/lib/entitlements";
import { limitsFor, type PlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/server";

export type UsageMeter = { label: string; used: number; limit: number; unit: string; resets: string };

const dayAgo = () => new Date(Date.now() - 86_400_000).toISOString();
const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

/**
 * What a student has used against their plan's allowances, for the meters on /home.
 * Counts match the checks in the tutor and practice routes so the numbers never disagree.
 */
export async function usageSummary(userId: string, plan: PlanId): Promise<UsageMeter[]> {
  const limits = limitsFor(plan);
  const db = createAdminClient();

  const [{ count: questions }, { count: practice }, { data: lectures }, { count: assignments }] = await Promise.all([
    db.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "tutor").gte("created_at", dayAgo()),
    db.from("practice_items").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", dayAgo()),
    db.from("sessions").select("video_id, videos(duration_seconds)").eq("user_id", userId).not("video_id", "is", null).gte("created_at", startOfMonth()),
    db.from("assignments").select("id", { count: "exact", head: true }).eq("user_id", userId).gt("page_count", 0).gte("created_at", startOfMonth()),
  ]);

  const meters: UsageMeter[] = [
    { label: "Tutor questions", used: questions ?? 0, limit: limits.tutorQuestionsPerDay, unit: "today", resets: "resets every 24 hours" },
    { label: "Practice problems", used: practice ?? 0, limit: limits.practiceProblemsPerDay, unit: "today", resets: "resets every 24 hours" },
  ];

  const added = lectures ?? [];
  if (limits.lecturesPerMonth !== null) {
    meters.push({ label: "Lectures added", used: added.length, limit: limits.lecturesPerMonth, unit: "this month", resets: "resets on the 1st" });
  } else if (limits.lectureHoursPerMonth !== null) {
    const hours = added.reduce((n, s) => n + ((s.videos as unknown as { duration_seconds: number | null } | null)?.duration_seconds ?? 0), 0) / 3600;
    meters.push({ label: "Lecture hours", used: Math.round(hours * 10) / 10, limit: limits.lectureHoursPerMonth, unit: "this month", resets: "resets on the 1st" });
  }
  if (limits.assignmentsPerMonth !== null) {
    meters.push({ label: "Homework uploads", used: assignments ?? 0, limit: limits.assignmentsPerMonth, unit: "this month", resets: "resets on the 1st" });
  }
  return meters;
}

export const planLabel = (plan: PlanId) => ({ free: "Free", plus: "Plus", pro: "Pro" })[plan];
export { effectivePlan };
