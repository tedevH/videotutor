import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/home", "/watch/", "/board", "/practice", "/brain", "/courses", "/homework", "/settings", "/try", "/dev-preview"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
