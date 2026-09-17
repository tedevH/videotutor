import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

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

export function AppNav({ current }: { current: (typeof LINKS)[number][0] }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/home" className="text-xl font-semibold tracking-tight">
        LumoTutor
      </Link>
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {LINKS.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3 py-1.5 ${current === href ? "bg-ink font-medium text-white" : "text-ink/70 hover:bg-white hover:text-ink"}`}
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
