/** Plans shown on the pricing page and enforced across the app. */

export type PlanId = "free" | "plus" | "pro";
export type BillingInterval = "month" | "year";
export type PaidPlanId = Exclude<PlanId, "free">;

export type PlanLimits = {
  /** Lectures added per calendar month (Free), or hours of lecture video per month (paid). */
  lecturesPerMonth: number | null;
  lectureHoursPerMonth: number | null;
  tutorQuestionsPerDay: number;
  practiceProblemsPerDay: number;
  voice: boolean;
  /** Code-checked solving and answer review for hard questions. */
  verifiedMath: boolean;
  examPrep: boolean;
  bestModels: boolean;
};

export const PLANS: Record<
  PlanId,
  {
    name: string;
    tagline: string;
    limits: PlanLimits;
    features: string[];
    monthly?: { price: number; lookupKey: string };
    yearly?: { price: number; lookupKey: string };
  }
> = {
  free: {
    name: "Free",
    tagline: "Try Lumo",
    limits: {
      lecturesPerMonth: 2,
      lectureHoursPerMonth: null,
      tutorQuestionsPerDay: 15,
      practiceProblemsPerDay: 5,
      voice: false,
      verifiedMath: false,
      examPrep: false,
      bestModels: false,
    },
    features: ["2 lectures a month", "Basic AI tutor", "5 practice problems a day", "Basic learning memory"],
  },
  plus: {
    name: "Plus",
    tagline: "Your personal AI teacher for every class.",
    limits: {
      lecturesPerMonth: null,
      lectureHoursPerMonth: 25,
      tutorQuestionsPerDay: 150,
      practiceProblemsPerDay: 60,
      voice: true,
      verifiedMath: true,
      examPrep: true,
      bestModels: false,
    },
    features: [
      "25 hours of lectures a month",
      "Full interactive tutoring",
      "Voice tutoring",
      "AI-drawn diagrams and whiteboard",
      "Adaptive practice",
      "Persistent learning memory",
      "Exam prep plans",
    ],
    monthly: { price: 9.99, lookupKey: "lumotutor_plus_monthly" },
    yearly: { price: 79.99, lookupKey: "lumotutor_plus_yearly" },
  },
  pro: {
    name: "Pro",
    tagline: "For heavy course loads and exam season.",
    limits: {
      lecturesPerMonth: null,
      lectureHoursPerMonth: 100,
      tutorQuestionsPerDay: 400,
      practiceProblemsPerDay: 200,
      voice: true,
      verifiedMath: true,
      examPrep: true,
      bestModels: true,
    },
    features: [
      "100+ hours of lectures a month",
      "Everything in Plus",
      "Highest-quality AI models",
      "Advanced diagrams and visualizations",
      "Deep course analysis",
      "Intensive exam preparation",
      "Priority processing",
    ],
    monthly: { price: 19.99, lookupKey: "lumotutor_pro_monthly" },
    yearly: { price: 159.99, lookupKey: "lumotutor_pro_yearly" },
  },
};

export const PAID_PLANS: PaidPlanId[] = ["plus", "pro"];

export function lookupKeyFor(plan: PaidPlanId, interval: BillingInterval) {
  const p = PLANS[plan];
  return (interval === "year" ? p.yearly : p.monthly)!.lookupKey;
}

/** Maps a Stripe price lookup key back to its plan (older "videotutor_pro_*" prices count as Plus). */
export function planForLookupKey(key: string | null | undefined): PaidPlanId {
  if (key?.startsWith("lumotutor_pro")) return "pro";
  return "plus";
}

export const limitsFor = (plan: string | null | undefined) => PLANS[(plan as PlanId) in PLANS ? (plan as PlanId) : "free"].limits;

/** Referral reward: invite this many friends who sign up, unlock this many days of Plus. */
export const REFERRAL = { friendsNeeded: 2, rewardDays: 14, maxRewards: 3 } as const;
