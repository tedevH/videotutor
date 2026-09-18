import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { planFor } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

const LINKS = [
  ["/home", "Home"],
  ["/library", "Videos"],
  ["/courses", "Courses"],
  ["/homework", "Homework"],
  ["/practice", "Practice"],
  ["/board", "Whiteboard"],
  ["/brain", "Lumo Brain"],
  ["/invite", "🎁 Invite"],
  ["/settings", "Settings"],
] as const;

type NavHref = (typeof LINKS)[number][0] | "/pricing";

export async function AppNav({ current }: { current: NavHref }) {
  // Students without a paid plan always have a way to see what upgrading gets them.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const plan = user ? (await planFor(user.id)).plan : "free";
  const links: (readonly [string, string])[] = [...LINKS];
  if (plan === "free") links.splice(links.length - 1, 0, ["/pricing", "✨ Pricing"]);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/home" className="text-xl font-semibold tracking-tight">
        LumoTutor
      </Link>
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3 py-1.5 ${
              current === href
                ? "bg-ink font-medium text-white"
                : href === "/pricing"
                  ? "font-medium text-pen hover:bg-white"
                  : "text-ink/70 hover:bg-white hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="ml-2">
          <SignOutButton />
        </span>
      </nav>
    </header>
  );
}
