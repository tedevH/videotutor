import type { Metadata } from "next";
import Link from "next/link";
import { BlogHeader } from "@/components/blog/blog-header";
import { listPosts } from "@/lib/blog";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: "How students actually learn from lectures and problem sets, what goes wrong, and what the evidence says works.",
  alternates: { canonical: `${SITE.url}/blog` },
};

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function BlogIndex() {
  const posts = listPosts();
  return (
    <main className="min-h-dvh bg-[#fbfaf7] text-ink">
      <BlogHeader />
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">The LumoTutor blog</h1>
        <p className="mt-3 max-w-xl text-lg text-ink/70">
          How students actually learn from lectures and problem sets, where it goes wrong, and what the research says works.
        </p>

        <ul className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block py-7">
                <p className="text-sm text-muted">
                  {fmt(post.date)} · {post.readingMinutes} min read
                  {post.draft && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">draft</span>}
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold leading-snug tracking-tight group-hover:text-pen">{post.title}</h2>
                <p className="mt-2 leading-relaxed text-ink/70">{post.description}</p>
              </Link>
            </li>
          ))}
        </ul>
        {!posts.length && <p className="mt-10 text-muted">The first post is on its way.</p>}
      </div>
    </main>
  );
}
