import type { Role, Session } from "@/lib/types";
import { ServiceError } from "../service";
import { findByEmail, startSession } from "./mockService";
import type { OutboxEmail } from "./seed";
import { getDb } from "./store";

/**
 * Demo-only helpers (mock mode). Nothing here exists in the real API.
 * Turn every demo tool off with NEXT_PUBLIC_DEMO_TOOLS=false.
 */
export const DEMO_TOOLS_ENABLED = process.env.NEXT_PUBLIC_DEMO_TOOLS !== "false";

export interface DemoAccount {
  email: string;
  name: string;
  role: Role;
  facilityName: string | null;
  status: string;
}

/** Seeded accounts for the quick sign-in list. Client-side only. */
export function listDemoAccounts(): DemoAccount[] {
  const db = getDb();
  const facilityName = new Map(db.facilities.map((f) => [f.id, f.name]));
  return db.users.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    facilityName: u.facilityId ? (facilityName.get(u.facilityId) ?? null) : null,
    status: u.status,
  }));
}

/**
 * One-click sign-in for demos. Skips the password (so it still works after someone
 * changes theirs) but applies the same account rules as a normal login.
 */
export async function demoSignIn(email: string): Promise<Session> {
  const user = findByEmail(email);
  if (!user) throw new ServiceError("NOT_FOUND", "No such demo account.");
  return startSession(user);
}

/** The newest email the mock "sent" to an address — stands in for checking an inbox. */
export function latestEmailTo(email: string): OutboxEmail | undefined {
  const e = email.trim().toLowerCase();
  return [...getDb().outbox].reverse().find((m) => m.to.toLowerCase() === e);
}

/** Make mock writes fail, to test how the UI handles a dropped connection. */
export { getNetworkFailure, setNetworkFailure } from "./store";
