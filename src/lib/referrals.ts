import { REFERRAL } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;
export const REFERRAL_COOKIE = "lumo_ref";

/**
 * Credits a referral once the friend has created an account. Every 2 friends unlock 14 days of Plus
 * for the referrer (stacking onto any trial still running), up to a cap.
 */
export async function recordReferral(referredUserId: string, code: string) {
  const db = createAdminClient();
  const { data: referrer } = await db.from("profiles").select("id, plus_trial_until, referral_rewards").eq("referral_code", code.toLowerCase()).maybeSingle();
  if (!referrer || referrer.id === referredUserId) return;

  // Only brand-new accounts count, so existing users can't be "referred" after the fact.
  const { data: user } = await db.auth.admin.getUserById(referredUserId);
  if (!user?.user || Date.now() - new Date(user.user.created_at).getTime() > DAY_MS) return;

  const { error } = await db.from("referrals").insert({ referrer_id: referrer.id, referred_id: referredUserId });
  if (error) return; // already referred
  await db.from("profiles").update({ referred_by: referrer.id }).eq("id", referredUserId);

  const { count } = await db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", referrer.id);
  const earned = Math.min(REFERRAL.maxRewards, Math.floor((count ?? 0) / REFERRAL.friendsNeeded));
  if (earned > referrer.referral_rewards) {
    const base = Math.max(Date.now(), referrer.plus_trial_until ? new Date(referrer.plus_trial_until).getTime() : 0);
    await db
      .from("profiles")
      .update({
        referral_rewards: earned,
        plus_trial_until: new Date(base + REFERRAL.rewardDays * DAY_MS * (earned - referrer.referral_rewards)).toISOString(),
      })
      .eq("id", referrer.id);
  }
}

export async function referralStatus(userId: string) {
  const db = createAdminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    db.from("profiles").select("referral_code, plus_trial_until, referral_rewards").eq("id", userId).maybeSingle(),
    db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
  ]);
  const friends = count ?? 0;
  return {
    code: profile?.referral_code ?? null,
    friends,
    towardNext: friends % REFERRAL.friendsNeeded,
    rewardsEarned: profile?.referral_rewards ?? 0,
    maxedOut: (profile?.referral_rewards ?? 0) >= REFERRAL.maxRewards,
    plusTrialUntil: profile?.plus_trial_until && new Date(profile.plus_trial_until).getTime() > Date.now() ? profile.plus_trial_until : null,
  };
}
