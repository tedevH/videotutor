import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogHeader } from "@/components/blog/blog-header";
import { PostBody } from "@/components/blog/post-body";
import { getPost, listPosts } from "@/lib/blog";
import { SITE } from "@/lib/site";

// Every post is built at deploy time; an unknown slug is a 404, never an on-demand render.
export const dynamicParams = false;

export function generateStaticParams() {
  return listPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${SITE.url}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    authors: [{ name: post.author }],
    keywords: post.tags,
    robots: post.draft ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE.url}/blog/${post.slug}`;
  // Article structured data, so search engines know the headline, dates and author.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: { "@type": post.author === SITE.name ? "Organization" : "Person", name: post.author },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.tags.join(", "),
  };

  return (
    <main className="min-h-dvh bg-[#fbfaf7] text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <BlogHeader />
      <article className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 sm:px-6">
        <Link href="/blog" className="text-sm text-muted hover:text-ink">
          ← All posts
        </Link>
        <h1 className="mt-6 text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-[44px]">{post.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink/70">{post.description}</p>
        <p className="mt-5 text-sm text-muted">
          {post.author} · {fmt(post.date)}
          {post.updated && post.updated !== post.date ? ` · updated ${fmt(post.updated)}` : ""} · {post.readingMinutes} min read
        </p>
        <hr className="my-8 border-ink/10" />

        <PostBody markdown={post.body} />

        <aside className="mt-16 rounded-3xl border-2 border-ink bg-white p-6 shadow-[5px_5px_0_#1c1b19]">
          <p className="text-xl font-semibold tracking-tight">Stuck on a lecture or a problem set right now?</p>
          <p className="mt-2 text-ink/75">
            Pause any lecture and ask about that exact moment, or upload your homework and Lumo finds the step that went wrong. No account needed to try it.
          </p>
          <Link
            href={`/try?ref=blog-${post.slug}`}
            className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 font-medium text-white hover:bg-ink/85"
          >
            Try LumoTutor free →
          </Link>
        </aside>
      </article>
    </main>
  );
}
