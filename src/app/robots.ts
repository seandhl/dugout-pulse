import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  // Crawling is needed for bots to see the site-wide noindex directive.
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
  };
}
