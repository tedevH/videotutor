import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/blog";
import { SITE } from "@/lib/site";

/** Only the pages a signed-out visitor can actually read. */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(SITE.legalUpdated);
  return [
    { url: SITE.url, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/pricing`, lastModified: updated, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE.url}/login`, lastModified: updated, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/terms`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    // Each published post, dated by its last real edit so search engines re-crawl what changed.
    ...listPosts()
      .filter((post) => !post.draft)
      .map((post) => ({
        url: `${SITE.url}/blog/${post.slug}`,
        lastModified: new Date(post.updated ?? post.date),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
  ];
}
