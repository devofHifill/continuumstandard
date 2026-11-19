import type { Session } from "@/lib/types";
import { createSeed, MOCK_DB_VERSION, type MockDb } from "./seed";

/**
 * Persistence for the mock backend: one JSON blob in localStorage plays the role
 * of the database, so data survives page refreshes (needed to prove §7.1 step 8).
 * All access is wrapped in try/catch — storage can be unavailable (private mode,
 * blocked cookies), in which case we fall back to in-memory data.
 */

const DB_KEY = "cs-demo-db";
const SESSION_KEY = "cs-demo-session";

const isBrowser = typeof window !== "undefined";

let db: MockDb | null = null;
let session: Session | null | undefined; // undefined = not loaded yet
const listeners = new Set<() => void>();

function read<T>(key: string): T | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (!isBrowser) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — keep working in memory.
  }
}

function notify() {
  listeners.forEach((l) => l());
}

export function getDb(): MockDb {
  if (!db) {
    const stored = read<MockDb>(DB_KEY);
    // Seed shape changed? Start fresh rather than crash on old data.
    db = stored && stored.version === MOCK_DB_VERSION ? stored : createSeed();
  }
  return db;
}

/** Apply a change to the database, persist it, and notify subscribers. */
export function updateDb(mutate: (draft: MockDb) => void) {
  const next = structuredClone(getDb());
  mutate(next);
  db = next;
  write(DB_KEY, db);
  notify();
}

export function getStoredSession(): Session | null {
  if (session === undefined) session = read<Session>(SESSION_KEY);
  return session;
}

export function setStoredSession(next: Session | null) {
  session = next;
  write(SESSION_KEY, next);
  notify();
}

export function resetStore() {
  db = createSeed();
  write(DB_KEY, db);
  setStoredSession(null);
}

/** Demo-only "network failure" switch (in memory, resets on reload). */
let networkFailure = false;
export function getNetworkFailure() {
  return networkFailure;
}
export function setNetworkFailure(on: boolean) {
  networkFailure = on;
  notify();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync: a change in another tab fires a storage event here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === DB_KEY) db = null;
    if (e.key === SESSION_KEY) session = undefined;
    if (e.key === DB_KEY || e.key === SESSION_KEY) listener();
  };
  if (isBrowser) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (isBrowser) window.removeEventListener("storage", onStorage);
  };
}
