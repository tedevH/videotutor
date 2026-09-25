import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

/**
 * Blog posts are Markdown files in content/blog, rendered to static pages at build time.
 * A post is published by merging it: the drafting job opens a pull request, a person reviews
 * the preview deploy, and merging to main puts it on lumotutor.com.
 */
const BLOG_DIR = join(process.cwd(), "content", "blog");

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated: string | null;
  author: string;
  tags: string[];
  draft: boolean;
  body: string;
  readingMinutes: number;
};

const WORDS_PER_MINUTE = 230;

function parse(file: string): Post {
  const raw = readFileSync(join(BLOG_DIR, file), "utf8");
  const { data, content } = matter(raw);
  const slug = file.replace(/\.md$/, "");
  const required = ["title", "description", "date"] as const;
  for (const key of required) {
    if (!data[key]) throw new Error(`content/blog/${file} is missing "${key}" in its frontmatter`);
  }
  const words = content.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title: String(data.title),
    description: String(data.description),
    date: new Date(data.date).toISOString().slice(0, 10),
    updated: data.updated ? new Date(data.updated).toISOString().slice(0, 10) : null,
    author: data.author ? String(data.author) : "LumoTutor",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    draft: data.draft === true,
    body: content.trim(),
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}

/** Files starting with "_" (the idea backlog, vetted sources) are working notes, never pages. */
const isPostFile = (f: string) => f.endsWith(".md") && !f.startsWith("_") && f !== "README.md";

/** Published posts, newest first. Drafts show in development so they can be previewed locally. */
export function listPosts(): Post[] {
  const showDrafts = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
  return readdirSync(BLOG_DIR)
    .filter(isPostFile)
    .map(parse)
    .filter((p) => showDrafts || !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | null {
  return listPosts().find((p) => p.slug === slug) ?? null;
}
