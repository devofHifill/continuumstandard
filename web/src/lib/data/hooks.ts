"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Session } from "@/lib/types";
import { data } from "./index";

const subscribe = (cb: () => void) => data.subscribe(cb);

/**
 * The signed-in user, kept in sync with login/logout/reset (also across tabs).
 * `undefined` while hydrating (the server can't read the browser's session),
 * then `Session` or `null` — so pages can show a loader instead of flashing a redirect.
 */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => data.getSession(),
    () => undefined,
  );
}

const noopSubscribe = () => () => {};

/** false during server render and hydration, true afterwards. For browser-only data. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export type QueryState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: Error };

/**
 * Minimal data-fetching hook: runs `fn`, tracks loading/success/error, and re-runs
 * whenever the mock store changes or `key` changes. Intentionally tiny — a library
 * like TanStack Query can replace it when the real API arrives.
 */
export function useQuery<T>(key: string, fn: () => Promise<T>): QueryState<T> {
  const [state, setState] = useState<QueryState<T> & { key?: string }>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => data.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (result) => !cancelled && setState({ status: "success", data: result, key }),
      (error: Error) => !cancelled && setState({ status: "error", error, key }),
    );
    return () => {
      cancelled = true;
    };
    // `fn` is intentionally excluded: callers pass inline functions; `key` identifies the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  // A new key means the old result is stale — show loading until the new one arrives.
  if (state.key !== undefined && state.key !== key) return { status: "loading" };
  return state;
}
