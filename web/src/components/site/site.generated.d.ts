/* Types for the generated site script (scripts/port-public-site.py). */
export function initSite(
  root: HTMLElement,
  opts: { onDemoRequest: (payload: Record<string, string>) => Promise<unknown> },
): () => void;
