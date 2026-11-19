import type { Role } from "@/lib/types";
import { DEMO_PASSWORD } from "./seed";
import { getDb } from "./store";

/** Demo tools (quick sign-in, role switcher, reset) — on unless explicitly turned off. */
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

export const demoPassword = DEMO_PASSWORD;
