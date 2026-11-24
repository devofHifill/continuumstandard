import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/components/site/metadata";
import { SITE_PATHS } from "@/components/site/pages";

/** sitemap.xml: the public website's pages (the signed-in app is never listed). */
export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_PATHS.filter((p) => p !== "/privacy" && p !== "/terms").map((path) => ({
    url: `${SITE_BASE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
