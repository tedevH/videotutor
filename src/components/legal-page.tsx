import Link from "next/link";
import { SITE } from "@/lib/site";

/** Shared shell for Terms and Privacy: readable measure, plain type, obvious way back. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const updated = new Date(SITE.legalUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <main className="min-h-dvh bg-[#fbfaf7] text-ink">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ← {SITE.name}
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
        <div className="legal mt-8 space-y-4 leading-relaxed text-ink/85 [&_a]:font-medium [&_a]:text-pen [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
        <footer className="mt-12 border-t border-ink/15 pt-6 text-sm text-muted">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <span className="px-2">·</span>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <span className="px-2">·</span>
          <a href={`mailto:${SITE.supportEmail}`} className="hover:text-ink">
            {SITE.supportEmail}
          </a>
        </footer>
      </div>
    </main>
  );
}
