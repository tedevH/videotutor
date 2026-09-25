/** Plans shown on the pricing page and enforced across the app. */

export type PlanId = "free" | "plus" | "pro";
export type BillingInterval = "month" | "year";
export type PaidPlanId = Exclude<PlanId, "free">;

export type PlanLimits = {
  /** Lectures added per calendar month (Free), or hours of lecture video per month (paid). */
  lecturesPerMonth: number | null;
  lectureHoursPerMonth: number | null;
  tutorQuestionsPerDay: number;
  /** The real bound on cost: a daily cap alone allows 30x that every month. */
  tutorQuestionsPerMonth: number;
  /** Homework/quizzes uploaded per month; null is unlimited. */
  assignmentsPerMonth: number | null;
  practiceProblemsPerDay: number;
  practiceProblemsPerMonth: number;
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
      tutorQuestionsPerMonth: 100,
      assignmentsPerMonth: 1,
      practiceProblemsPerDay: 5,
      practiceProblemsPerMonth: 40,
      voice: false,
      verifiedMath: false,
      examPrep: false,
      bestModels: false,
    },
    features: ["2 lectures a month", "100 tutor questions a month (15 a day)",
      "1 homework upload a month", "40 practice problems a month", "Basic learning memory", "Whiteboard and courses"],
  },
  plus: {
    name: "Plus",
    tagline: "Your personal AI teacher for every class.",
    limits: {
      lecturesPerMonth: null,
      lectureHoursPerMonth: 25,
      tutorQuestionsPerDay: 150,
      tutorQuestionsPerMonth: 600,
      assignmentsPerMonth: 20,
      practiceProblemsPerDay: 60,
      practiceProblemsPerMonth: 400,
      voice: true,
      verifiedMath: true,
      examPrep: true,
      bestModels: false,
    },
    features: [
      "25 hours of lectures a month",
      "600 tutor questions a month (150 a day)",
      "400 practice problems a month",
      "20 homework or quiz uploads a month",
      "Code-verified answers on hard problems",
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
      lectureHoursPerMonth: 50,
      tutorQuestionsPerDay: 400,
      tutorQuestionsPerMonth: 1000,
      assignmentsPerMonth: null,
      practiceProblemsPerDay: 200,
      practiceProblemsPerMonth: 700,
      voice: true,
      verifiedMath: true,
      examPrep: true,
      bestModels: true,
    },
    features: [
      "50 hours of lectures a month",
      "1,000 tutor questions a month (400 a day)",
      "700 practice problems a month",
      "Unlimited homework uploads",
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

/**
 * What someone gets before making an account. Enough to see Lumo work on a real problem, and
 * costed so a stranger clicking around can't run up a bill: no lecture indexing, no uploads.
 */
export const GUEST_QUESTIONS = 8;
export const GUEST_LIMITS: PlanLimits = {
  lecturesPerMonth: 0,
  lectureHoursPerMonth: null,
  tutorQuestionsPerDay: GUEST_QUESTIONS,
  tutorQuestionsPerMonth: GUEST_QUESTIONS,
  assignmentsPerMonth: 0,
  practiceProblemsPerDay: 0,
  practiceProblemsPerMonth: 0,
  voice: false,
  verifiedMath: false,
  examPrep: false,
  bestModels: false,
};

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
