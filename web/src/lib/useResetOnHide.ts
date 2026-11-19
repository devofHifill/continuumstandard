"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Run `reset` when Next.js hides this page.
 *
 * Next.js 16 keeps recently visited pages mounted inside React's <Activity> instead of
 * unmounting them, so state survives navigation. That's great for drafts, but wrong for
 * one-off flags like "submitting…" or "email sent". Hiding runs layout-effect cleanups,
 * so this resets those flags before the page can be shown again.
 * (node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md)
 */
export function useResetOnHide(reset: () => void) {
  const ref = useRef(reset);
  useLayoutEffect(() => {
    ref.current = reset;
  });
  useLayoutEffect(() => () => ref.current(), []);
}
