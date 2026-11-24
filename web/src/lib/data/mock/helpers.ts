import type { ID, LearnerProgress, Session, User } from "@/lib/types";
import { ServiceError, type AuthTokenPurpose } from "../service";
import { getDb, getNetworkFailure, getStoredSession, setStoredSession } from "./store";

/**
 * Shared helpers for the mock backend: latency, the session check every request runs,
 * tenant scoping, and small utilities. Split out so each service module can use them.
 */

/** Small artificial delay so loading states are visible, like a real network. */
export const LATENCY_MS = 150;
/**
 * Every mock response goes through here: a small artificial latency, and — when the demo's
 * "simulate connection problems" switch is on — a NETWORK error instead, so loading and error
 * states can be seen and tested in the browser (F7.1). Writes also check before changing data
 * (simulateNetwork), so a failed write never half-applies.
 */
export const delay = <T>(value: T) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(
      () =>
        getNetworkFailure()
          ? reject(new ServiceError("NETWORK", "Can't reach the server. Check your connection and try again."))
          : resolve(value),
      LATENCY_MS,
    ),
  );
export const clone = <T>(value: T): T => structuredClone(value);

export function requireSession(): Session {
  const s = getStoredSession();
  if (!s) throw new ServiceError("UNAUTHENTICATED", "Please sign in.");
  // Every request re-checks the account, like a real API would on each call.
  // (The UI's AuthGate notices and signs out with an explanation.)
  const reason = sessionProblem(s);
  if (reason) throw new ServiceError("UNAUTHENTICATED", reason);
  return s;
}

/** Why a session is no longer valid (account deactivated, facility switched off), or null. */
export function sessionProblem(s: Session): string | null {
  const db = getDb();
  const user = db.users.find((u) => u.id === s.userId);
  if (!user || user.status !== "ACTIVE") return "Your account is no longer active. Contact your administrator.";
  const facility = user.facilityId ? db.facilities.find((f) => f.id === user.facilityId) : null;
  if (user.facilityId && (!facility || !facility.isActive)) return "Your facility's access is currently inactive.";
  return null;
}

/** Shared sign-in rules for password login, emailed links and the demo account picker. */
export function startSession(user: User): Session {
  if (user.status === "DEACTIVATED") {
    throw new ServiceError("FORBIDDEN", "This account has been deactivated. Contact your administrator.");
  }
  if (user.status === "INVITED") {
    throw new ServiceError("FORBIDDEN", "Please finish setting up your account from your invite email.");
  }
  const facility = user.facilityId ? getDb().facilities.find((f) => f.id === user.facilityId) : null;
  if (user.facilityId && (!facility || !facility.isActive)) {
    throw new ServiceError("FORBIDDEN", "Your facility's access is currently inactive.");
  }
  const session = toSession(user);
  setStoredSession(session);
  return session;
}

export function findByEmail(email: string) {
  const e = email.trim().toLowerCase();
  return getDb().users.find((u) => u.email.toLowerCase() === e);
}

export const RESET_TTL_MIN = 60;
export const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/** Unguessable link token from the browser's secure random generator. */
export function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A link is usable once, before it expires, and only for its own purpose. */
export function validToken(token: string, purpose: AuthTokenPurpose) {
  const db = getDb();
  const record = db.authTokens.find((t) => t.token === token && t.purpose === purpose);
  if (!record) throw new ServiceError("VALIDATION", "This link isn't valid. It may have been replaced by a newer one.");
  if (record.usedAt) throw new ServiceError("VALIDATION", "This link has already been used.");
  if (new Date(record.expiresAt).getTime() < Date.now()) throw new ServiceError("VALIDATION", "This link has expired.");
  const user = db.users.find((u) => u.id === record.userId);
  if (!user || user.status === "DEACTIVATED") throw new ServiceError("VALIDATION", "This account is no longer active.");
  return { record, user };
}

/**
 * Tenant scoping — the frontend copy of the rule the real API must enforce
 * (docs/HLD_LLD_LEARNING.md §5.3). Super Admin sees every facility; everyone else
 * only their own. The facility always comes from the session, never from the caller.
 */
export function inScope(session: Session, facilityId: ID | null): boolean {
  return session.role === "SUPER_ADMIN" || facilityId === session.facilityId;
}

/** Out-of-scope records look exactly like missing ones: 404, not 403. */
export function notFound(what: string): never {
  throw new ServiceError("NOT_FOUND", `${what} not found.`);
}

/**
 * A learner may only play, answer or save progress for modules assigned to them.
 * Not assigned → NOT_FOUND (same as a module that doesn't exist).
 */
export function assertAssigned(session: Session, moduleId: ID) {
  const assigned = getDb().assignments.some((a) => a.userId === session.userId && a.moduleId === moduleId);
  if (session.role !== "LEARNER" || !assigned) notFound("Module");
}

export function emptyProgress(userId: ID, moduleId: ID): LearnerProgress {
  return {
    userId,
    moduleId,
    status: "NOT_STARTED",
    lastPositionSec: 0,
    furthestSec: 0,
    videoCompleted: false,
    updatedAt: new Date().toISOString(),
  };
}

let idCounter = 0;
export function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Demo switch to test offline behaviour: when on, writes fail like a dropped connection. */
export function simulateNetwork() {
  if (getNetworkFailure()) throw new ServiceError("NETWORK", "Can't reach the server. Check your connection.");
}

export function toSession(user: User): Session {
  return {
    userId: user.id,
    role: user.role,
    facilityId: user.facilityId,
    name: user.name,
    email: user.email,
  };
}
