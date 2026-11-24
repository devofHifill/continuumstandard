import type { Metadata } from "next";
import type { SitePageKey } from "./pages";

/**
 * Per-page titles and descriptions for the public site. Descriptions reuse sentences from
 * the client's own copy; the client should review them with the rest of the site.
 */
export const SITE_BASE_URL = "https://www.continuum-standard.com"; // TODO (client): confirm the live domain

const PAGES: Record<SitePageKey, { title: string; description: string; path: string }> = {
  home: {
    title: "The Continuum-Standard | Behavioral Health Staff Training",
    description:
      "Scenario-based behavioral-health staff training designed to improve patient communication, engagement, and treatment continuity.",
    path: "/",
  },
  training: {
    title: "Training",
    description:
      "Each module is built around a moment staff will recognize, with communication approaches designed for behavioral-health environments.",
    path: "/training",
  },
  platform: {
    title: "Platform",
    description:
      "A technology-enabled training system with team management, a scenario library and leadership reporting built in.",
    path: "/platform",
  },
  "who-we-serve": {
    // Matches the site's menu label ("Facilities"); the address keeps the sitemap's wording.
    title: "Facilities",
    description: "Addiction, detox, residential, inpatient and mental-health organizations training entire teams.",
    path: "/who-we-serve",
  },
  about: {
    title: "About",
    description: "Built specifically around the communication challenges faced by addiction and mental-health treatment teams.",
    path: "/about",
  },
  privacy: {
    title: "Privacy Policy",
    description: "Placeholder — The Continuum-Standard's privacy policy.",
    path: "/privacy",
  },
  terms: {
    title: "Terms of Use",
    description: "Placeholder — The Continuum-Standard's terms of use.",
    path: "/terms",
  },
  contact: {
    title: "Request a Demo",
    description:
      "Tell us about your facility and we’ll walk your leadership team through the training library and platform.",
    path: "/contact",
  },
};

export function siteMetadata(key: SitePageKey): Metadata {
  const p = PAGES[key];
  const placeholder = key === "privacy" || key === "terms";
  return {
    // Placeholder legal pages shouldn't be indexed even after launch, until real text exists.
    ...(placeholder ? { robots: { index: false } } : {}),
    title: key === "home" ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: `${SITE_BASE_URL}${p.path}` },
    openGraph: { type: "website", siteName: "The Continuum-Standard", title: p.title, description: p.description, url: `${SITE_BASE_URL}${p.path}` },
    twitter: { card: "summary_large_image" },
    other: { "theme-color": "#17322A" },
  };
}
