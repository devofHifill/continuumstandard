import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/components/site/metadata";

/**
 * robots.txt. Until launch the whole site is closed to search engines (it runs on mock data
 * and placeholder content). Set SITE_ALLOW_INDEXING=true in the production environment to open
 * the public pages; the signed-in app and auth pages always stay out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_ALLOW_INDEXING !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/facility", "/learn", "/profile", "/poc", "/login", "/forgot-password", "/reset-password", "/set-password"],
    },
    sitemap: `${SITE_BASE_URL}/sitemap.xml`,
  };
}
