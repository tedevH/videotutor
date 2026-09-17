import { limitsFor, type PlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/server";

/** The plan a student can use right now: their subscription, or Plus while a referral trial runs. */
export function effectivePlan(profile: { plan?: string | null; plus_trial_until?: string | null } | null | undefined): PlanId {
  const plan = (profile?.plan as PlanId) ?? "free";
  if (plan === "pro" || plan === "plus") return plan;
  if (profile?.plus_trial_until && new Date(profile.plus_trial_until).getTime() > Date.now()) return "plus";
  return "free";
}

export async function planFor(userId: string) {
  const { data } = await createAdminClient().from("profiles").select("plan, plus_trial_until, school_level").eq("id", userId).maybeSingle();
  const plan = effectivePlan(data);
  return { plan, limits: limitsFor(plan), schoolLevel: data?.school_level ?? "college", onTrial: plan === "plus" && data?.plan !== "plus" };
}

const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

/** Checks the monthly homework allowance before a new upload. Returns an error message or null. */
export async function assignmentAllowanceError(userId: string, plan: PlanId) {
  const limit = limitsFor(plan).assignmentsPerMonth;
  if (limit === null) return null;
  const { count } = await createAdminClient()
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth());
  if ((count ?? 0) < limit) return null;
  return plan === "free"
    ? `The Free plan includes ${limit} homework upload a month. Plus includes 20, or invite 2 friends to unlock 14 days of Plus.`
    : `You've uploaded this month's ${limit} assignments. Pro has no limit.`;
}

/** Checks the monthly lecture allowance before adding a new video. Returns an error message or null. */
export async function lectureAllowanceError(userId: string, plan: PlanId) {
  const limits = limitsFor(plan);
  const db = createAdminClient();
  const { data: sessions } = await db
    .from("sessions")
    .select("video_id, videos(duration_seconds)")
    .eq("user_id", userId)
    .not("video_id", "is", null)
    .gte("created_at", startOfMonth());
  const added = sessions ?? [];
  if (limits.lecturesPerMonth !== null && added.length >= limits.lecturesPerMonth) {
    return `The Free plan includes ${limits.lecturesPerMonth} lectures a month. Upgrade to Plus for 25 hours of lectures, or invite 2 friends to unlock 14 days of Plus.`;
  }
  if (limits.lectureHoursPerMonth !== null) {
    const hours = added.reduce((n, s) => n + ((s.videos as unknown as { duration_seconds: number | null } | null)?.duration_seconds ?? 0), 0) / 3600;
    if (hours >= limits.lectureHoursPerMonth) {
      return plan === "plus"
        ? `You've used this month's ${limits.lectureHoursPerMonth} hours of lectures. Pro includes 100+ hours.`
        : `You've used this month's ${limits.lectureHoursPerMonth} hours of lectures. It resets on the 1st.`;
    }
  }
  return null;
}
