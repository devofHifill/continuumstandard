import { SITE_CONTACT, SITE_FOOTER, SITE_MODAL, SITE_SECTIONS, SITE_TOP } from "./markup.generated";

/**
 * The public site as separate pages (F6). The client's original is a one-page site; its
 * sections are reused unchanged and grouped into pages following the sitemap (scope doc §11).
 * No new marketing copy is written here — every word on the marketing pages comes from the
 * client's site. (The legal pages are clearly marked placeholders.)
 */
type SectionKey = keyof typeof SITE_SECTIONS;

export type SitePageKey =
  | "home"
  | "training"
  | "platform"
  | "who-we-serve"
  | "about"
  | "contact"
  | "privacy"
  | "terms";

interface PageDef {
  path: string;
  /** Screen-reader page heading for inner pages (see `pageHeading`). */
  heading?: string;
  sections: SectionKey[];
}

export const SITE_PAGES: Record<SitePageKey, PageDef> = {
  home: { path: "/", sections: ["top", "value", "challenge", "outcomes", "cta"] },
  training: { path: "/training", heading: "Training", sections: ["training", "how", "cta"] },
  platform: { path: "/platform", heading: "Platform", sections: ["platform", "pricing", "cta"] },
  "who-we-serve": { path: "/who-we-serve", heading: "Facilities", sections: ["facilities", "cta"] },
  about: { path: "/about", heading: "About", sections: ["about", "cta"] },
  contact: { path: "/contact", sections: [] },
  privacy: { path: "/privacy", sections: [] },
  terms: { path: "/terms", sections: [] },
};

/** Public pages for robots.txt / sitemap.xml. */
export const SITE_PATHS = Object.values(SITE_PAGES).map((p) => p.path);

/**
 * Every page needs one <h1>. Inner pages start with an ordinary section whose visible title is
 * an <h2> followed by <h3>s. Promoting that <h2> would leave the <h3>s skipping a level, and
 * renaming the <h3>s would break the designer's CSS (styled by tag). So inner pages get a
 * screen-reader-only <h1> naming the page, and the visible headings keep their levels:
 * h1 (page) → h2 (section) → h3 (items).
 */
function pageHeading(text: string): string {
  return `<h1 class="sr-only">${text}</h1>`;
}

/** Mark the current page in the main navigation (styled by the site's aria-current rule). */
function markCurrent(top: string, path: string): string {
  if (path === "/") return top;
  return top.replace(`class="nav__link" href="${path}"`, `class="nav__link" href="${path}" aria-current="page"`);
}

/** The shared call-to-action band shouldn't link to the page it's on ("Explore Training" on /training). */
function withoutSelfLink(html: string, path: string): string {
  return html.replace(new RegExp(`<a class="btn[^"]*" href="${path}">[^<]*</a>`, "g"), "");
}

/** /contact: the demo form on the page itself, with the footer's contact details beside it. */
function contactSection(): string {
  const c = SITE_CONTACT;
  return `<section class="section contact-page" aria-labelledby="demo-title">
  <div class="container contact-page__grid">
    <div class="contact-page__intro">
      <p class="eyebrow">${c.eyebrow}</p>
      <h1 id="demo-title">${c.heading}</h1>
      <p class="modal__lead">${c.lead}</p>
      <div class="contact-page__details">${c.details}</div>
    </div>
    <div class="modal__panel contact-page__card">
      <div class="modal__view" data-form-view>${c.form}</div>
      ${c.success}
    </div>
  </div>
</section>`;
}

/**
 * /privacy and /terms (F6.7): legal text is supplied by the client (scope doc §1.2), so these
 * say plainly that they're placeholders and list what the final text should cover.
 */
const LEGAL: Record<"privacy" | "terms", { title: string; topics: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    topics: [
      "What is collected through the demo-request form and staff accounts, and why",
      "That the platform uses synthetic training scenarios and must not hold patient information",
      "How long data is kept, who can see it, and how to ask for it to be deleted",
      "Cookies and analytics, if any are used",
      "Contact details for privacy questions",
    ],
  },
  terms: {
    title: "Terms of Use",
    topics: [
      "Who may use the platform and how accounts are issued by facilities",
      "That training content is educational and not clinical advice",
      "Acceptable use, including not entering patient information",
      "Ownership of training content and the facility’s data",
      "Liability, changes to the terms, and contact details",
    ],
  },
};

function legalSection(key: "privacy" | "terms"): string {
  const { title, topics } = LEGAL[key];
  return `<section class="section legal-page" aria-labelledby="legal-title">
  <div class="container legal-page__inner">
    <p class="eyebrow">Legal</p>
    <h1 id="legal-title">${title}</h1>
    <div class="legal-page__notice" role="note">
      <p><strong>Placeholder — legal text to be supplied.</strong></p>
      <p>This page will contain The Continuum-Standard’s approved ${title.toLowerCase()}. It is a placeholder and must be replaced with reviewed legal copy before launch.</p>
    </div>
    <p>Topics the final text is expected to cover (for the client’s legal reviewer):</p>
    <ul>${topics.map((t) => `<li>${t}</li>`).join("")}</ul>
  </div>
</section>`;
}

/** Full markup for one page: header, its sections, footer, and the demo modal where useful. */
export function buildPageMarkup(key: SitePageKey): string {
  const page = SITE_PAGES[key];
  let main: string;
  if (key === "contact") main = contactSection();
  else if (key === "privacy" || key === "terms") main = legalSection(key);
  else {
    main = page.sections
      .map((s) => (s === "cta" ? withoutSelfLink(SITE_SECTIONS.cta, page.path) : SITE_SECTIONS[s]))
      .join("\n");
    if (page.heading) main = pageHeading(page.heading) + main;
  }
  // The contact page shows the form inline, so it has no modal (its "Request a Demo"
  // links then simply stay on /contact).
  const modal = key === "contact" ? "" : SITE_MODAL;
  return `${markCurrent(SITE_TOP, page.path)}<main id="main" class="site-page site-page--${key}">${main}</main>${SITE_FOOTER}${modal}`;
}
