"use client";

import { useEffect, useRef } from "react";
import { data } from "@/lib/data";
import { buildPageMarkup, type SitePageKey } from "./pages";
import { initSite } from "./site.generated.js";
import "./site.generated.css";
import "./site-overrides.css";

/**
 * One page of the client's public website (F6), ported from their static HTML by
 * scripts/port-public-site.py and split into pages by ./pages.ts. Markup, CSS and behaviour
 * are the designer's; this component only hosts them:
 *
 *  - The markup is server-rendered (good for search engines and first paint).
 *  - The site's script starts after mount and returns a cleanup that removes every listener
 *    and timer. Next.js keeps visited pages alive but hidden, so the effect re-runs on each
 *    return — the markup is reset first so the script always starts on fresh DOM.
 *  - Demo requests go through the app's data layer → Super Admin "Demo Requests" (D9).
 */
export function SitePage({ page }: { page: SitePageKey }) {
  const ref = useRef<HTMLDivElement>(null);
  const markup = buildPageMarkup(page);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (root.dataset.started) root.innerHTML = markup; // returning to the page: start clean
    root.dataset.started = "1";
    return initSite(root, {
      onDemoRequest: (payload) =>
        data.submitDemoRequest({
          name: payload.name,
          organization: payload.organization,
          email: payload.email,
          phone: payload.phone,
          facilities: payload.facilities,
          message: payload.message,
          // Which page the request came from (the site's script always says "homepage").
          source: page === "home" ? "homepage" : `${page}-page`,
        }),
    });
  }, [markup, page]);

  // The markup is a fixed, trusted string from the client's site (no user input).
  return <div ref={ref} className="cs-site no-js" dangerouslySetInnerHTML={{ __html: markup }} />;
}
