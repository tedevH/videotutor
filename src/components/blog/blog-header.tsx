import Link from "next/link";

/** The blog is read by people who haven't signed up, so its header points at trying Lumo. */
export function BlogHeader() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        LumoTutor
      </Link>
      <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
        <Link href="/blog" className="text-ink/70 hover:text-ink">
          Blog
        </Link>
        <Link href="/pricing" className="hidden text-ink/70 hover:text-ink sm:inline">
          Pricing
        </Link>
        <Link href="/try?ref=blog-header" className="whitespace-nowrap rounded-full bg-ink px-4 py-2 font-medium text-white hover:bg-ink/85">
          Try it free
        </Link>
      </nav>
    </header>
  );
}
