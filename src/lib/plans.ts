/** Plans shown on the pricing page and enforced by the question endpoint. */
export const PLANS = {
  free: {
    name: "Free",
    questionsPerDay: 15,
    features: ["15 questions a day", "Any public lecture video", "Graphs, diagrams and annotated frames", "Saved questions and answers"],
  },
  pro: {
    name: "Pro",
    questionsPerDay: 200,
    monthly: { price: 9, lookupKey: "videotutor_pro_monthly" },
    yearly: { price: 72, lookupKey: "videotutor_pro_yearly" },
    features: [
      "200 questions a day",
      "Step-by-step, double-checked math for hard courses",
      "3D surfaces, linear maps and vector fields",
      "Full history to review before exams",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type BillingInterval = "month" | "year";

export const lookupKeyFor = (interval: BillingInterval) =>
  interval === "year" ? PLANS.pro.yearly.lookupKey : PLANS.pro.monthly.lookupKey;

export const questionsPerDay = (plan: string | null | undefined) =>
  plan === "pro" ? PLANS.pro.questionsPerDay : PLANS.free.questionsPerDay;
