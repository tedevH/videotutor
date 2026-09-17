/** One place to change the public details: swap these when the real domain and inbox exist. */
export const SITE = {
  name: "LumoTutor",
  tagline: "Pause any lecture and ask. Lumo explains that exact moment and draws on the frame you're stuck on.",
  /** Set NEXT_PUBLIC_SITE_URL in production; the Vercel URL is the fallback. */
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@lumotutor.com",
  company: "LumoTutor",
  /** Last time the Terms and Privacy Policy changed. */
  legalUpdated: "2026-09-17",
} as const;
