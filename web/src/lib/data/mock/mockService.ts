import type { ID, LearnerProgress, Session, User } from "@/lib/types";
import { ServiceError, type AuthTokenPurpose, type DataService, type ProgressUpdate } from "../service";
import { validatePassword } from "@/lib/auth/password";
import {
  getDb,
  getNetworkFailure,
  getStoredSession,
  resetStore,
  setStoredSession,
  subscribe,
  updateDb,
} from "./store";

/** Small artificial delay so loading states are visible, like a real network. */
const LATENCY_MS = 150;
const delay = <T>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), LATENCY_MS));
const clone = <T>(value: T): T => structuredClone(value);

function requireSession(): Session {
  const s = getStoredSession();
  if (!s) throw new ServiceError("UNAUTHENTICATED", "Please sign in.");
  // Every request re-checks the account, like a real API would on each call.
  // (The UI's AuthGate notices and signs out with an explanation.)
  const reason = sessionProblem(s);
  if (reason) throw new ServiceError("UNAUTHENTICATED", reason);
  return s;
}

/** Why a session is no longer valid (account deactivated, facility switched off), or null. */
function sessionProblem(s: Session): string | null {
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

const RESET_TTL_MIN = 60;
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/** Unguessable link token from the browser's secure random generator. */
function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A link is usable once, before it expires, and only for its own purpose. */
function validToken(token: string, purpose: AuthTokenPurpose) {
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
function inScope(session: Session, facilityId: ID | null): boolean {
  return session.role === "SUPER_ADMIN" || facilityId === session.facilityId;
}

/** Out-of-scope records look exactly like missing ones: 404, not 403. */
function notFound(what: string): never {
  throw new ServiceError("NOT_FOUND", `${what} not found.`);
}

/**
 * A learner may only play, answer or save progress for modules assigned to them.
 * Not assigned → NOT_FOUND (same as a module that doesn't exist).
 */
function assertAssigned(session: Session, moduleId: ID) {
  const assigned = getDb().assignments.some((a) => a.userId === session.userId && a.moduleId === moduleId);
  if (session.role !== "LEARNER" || !assigned) notFound("Module");
}

function emptyProgress(userId: ID, moduleId: ID): LearnerProgress {
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
function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Demo switch to test offline behaviour: when on, writes fail like a dropped connection. */
function simulateNetwork() {
  if (getNetworkFailure()) throw new ServiceError("NETWORK", "Can't reach the server. Check your connection.");
}

function toSession(user: User): Session {
  return {
    userId: user.id,
    role: user.role,
    facilityId: user.facilityId,
    name: user.name,
    email: user.email,
  };
}

export class MockDataService implements DataService {
  // ── Auth ────────────────────────────────────────────────
  async login(email: string, password: string) {
    const db = getDb();
    const user = findByEmail(email);
    // Same message for "no such user" and "wrong password" — don't reveal which emails exist.
    if (!user || !db.credentials[user.id] || db.credentials[user.id] !== password) {
      if (user?.status === "INVITED") {
        throw new ServiceError("FORBIDDEN", "Please finish setting up your account from your invite email.");
      }
      throw new ServiceError("UNAUTHENTICATED", "Email or password is incorrect.");
    }
    const session = startSession(user);
    return delay(clone(session));
  }

  async logout() {
    setStoredSession(null);
    return delay(undefined);
  }

  getSession() {
    return getStoredSession();
  }

  async refreshSession() {
    const s = getStoredSession();
    if (!s) return delay(null);
    const reason = sessionProblem(s);
    // The caller decides how to sign out (so it can explain why).
    if (reason) throw new ServiceError("UNAUTHENTICATED", reason);
    // Pick up profile changes (e.g. a renamed user) without signing out.
    const user = getDb().users.find((u) => u.id === s.userId)!;
    const fresh = toSession(user);
    if (JSON.stringify(fresh) !== JSON.stringify(s)) setStoredSession(fresh);
    return delay(clone(fresh));
  }

  async requestPasswordReset(email: string) {
    simulateNetwork();
    const user = findByEmail(email);
    // Only active accounts get a link, but the caller always gets the same answer (no enumeration).
    if (user && user.status === "ACTIVE") {
      const token = randomToken();
      updateDb((d) => {
        // A new link replaces any older unused reset link.
        d.authTokens = d.authTokens.filter((t) => !(t.userId === user.id && t.purpose === "RESET" && !t.usedAt));
        d.authTokens.push({ token, userId: user.id, purpose: "RESET", expiresAt: inMinutes(RESET_TTL_MIN) });
        d.outbox.push({
          id: newId("mail"),
          to: user.email,
          subject: "Reset your Continuum-Standard password",
          link: `/reset-password?token=${token}`,
          createdAt: new Date().toISOString(),
        });
      });
    }
    return delay(undefined);
  }

  async checkAuthToken(token: string, purpose: AuthTokenPurpose) {
    const { user } = validToken(token, purpose);
    return delay({ name: user.name, email: user.email });
  }

  async completeAuthToken(token: string, purpose: AuthTokenPurpose, newPassword: string) {
    simulateNetwork();
    const { record, user } = validToken(token, purpose);
    const problem = validatePassword(newPassword);
    if (problem) throw new ServiceError("VALIDATION", problem);
    updateDb((d) => {
      d.credentials[user.id] = newPassword;
      const t = d.authTokens.find((x) => x.token === record.token)!;
      t.usedAt = new Date().toISOString();
      if (purpose === "INVITE") d.users.find((u) => u.id === user.id)!.status = "ACTIVE";
    });
    // Setting a password from a valid emailed link proves the email address, so sign straight in.
    const fresh = getDb().users.find((u) => u.id === user.id)!;
    const session = startSession(fresh);
    return delay(clone(session));
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const s = requireSession();
    simulateNetwork();
    if (getDb().credentials[s.userId] !== currentPassword) {
      throw new ServiceError("VALIDATION", "Your current password is incorrect.");
    }
    const problem = validatePassword(newPassword);
    if (problem) throw new ServiceError("VALIDATION", problem);
    if (newPassword === currentPassword) {
      throw new ServiceError("VALIDATION", "Choose a different password from your current one.");
    }
    updateDb((d) => {
      d.credentials[s.userId] = newPassword;
    });
    return delay(undefined);
  }

  async updateMyProfile(update: { name: string; jobTitle?: string }) {
    const s = requireSession();
    simulateNetwork();
    const name = update.name.trim();
    if (!name) throw new ServiceError("VALIDATION", "Enter your name.");
    if (name.length > 80) throw new ServiceError("VALIDATION", "Keep your name under 80 characters.");
    updateDb((d) => {
      const u = d.users.find((x) => x.id === s.userId)!;
      u.name = name;
      u.jobTitle = update.jobTitle?.trim() || undefined;
    });
    const user = getDb().users.find((u) => u.id === s.userId)!;
    setStoredSession(toSession(user));
    return delay(clone(user));
  }

  // ── Facilities ──────────────────────────────────────────
  async listFacilities() {
    const s = requireSession();
    return delay(clone(getDb().facilities.filter((f) => inScope(s, f.id))));
  }

  async getFacility(id: ID) {
    const s = requireSession();
    const f = getDb().facilities.find((x) => x.id === id);
    if (!f || !inScope(s, f.id)) notFound("Facility");
    return delay(clone(f));
  }

  // ── Users ───────────────────────────────────────────────
  async listUsers(filter: { role?: User["role"]; facilityId?: ID } = {}) {
    const s = requireSession();
    if (s.role === "LEARNER") throw new ServiceError("FORBIDDEN", "Not allowed.");
    const users = getDb().users.filter(
      (u) =>
        inScope(s, u.facilityId) &&
        // A Facility Admin never sees the Super Admin account.
        (s.role === "SUPER_ADMIN" || u.role !== "SUPER_ADMIN") &&
        (!filter.role || u.role === filter.role) &&
        (!filter.facilityId || u.facilityId === filter.facilityId),
    );
    return delay(clone(users));
  }

  async getUser(id: ID) {
    const s = requireSession();
    const user = getDb().users.find((u) => u.id === id);
    const allowed =
      user &&
      (s.role === "SUPER_ADMIN" ||
        s.userId === id ||
        (s.role === "FACILITY_ADMIN" && user.facilityId === s.facilityId && user.role !== "SUPER_ADMIN"));
    if (!user || !allowed) notFound("User");
    return delay(clone(user));
  }

  // ── Training content ────────────────────────────────────
  async listModules() {
    const s = requireSession();
    const modules = getDb().modules.filter((m) => s.role === "SUPER_ADMIN" || m.status === "ACTIVE");
    return delay(clone(modules));
  }

  // ── Assignments & progress ──────────────────────────────
  async listAssignments(filter: { userId?: ID; moduleId?: ID } = {}) {
    const s = requireSession();
    const rows = getDb().assignments.filter(
      (a) =>
        inScope(s, a.facilityId) &&
        (s.role !== "LEARNER" || a.userId === s.userId) &&
        (!filter.userId || a.userId === filter.userId) &&
        (!filter.moduleId || a.moduleId === filter.moduleId),
    );
    return delay(clone(rows));
  }

  async listProgress(filter: { userId?: ID; moduleId?: ID } = {}) {
    const s = requireSession();
    const db = getDb();
    // Progress has no facilityId of its own — it's scoped through its user (validated parent).
    const facilityOf = new Map(db.users.map((u) => [u.id, u.facilityId]));
    const rows = db.progress.filter(
      (p) =>
        inScope(s, facilityOf.get(p.userId) ?? null) &&
        (s.role !== "LEARNER" || p.userId === s.userId) &&
        (!filter.userId || p.userId === filter.userId) &&
        (!filter.moduleId || p.moduleId === filter.moduleId),
    );
    return delay(clone(rows));
  }

  // ── Scenario player (F1) ────────────────────────────────
  async getPlayback(moduleId: ID) {
    const s = requireSession();
    const db = getDb();
    assertAssigned(s, moduleId);
    const trainingModule = db.modules.find((m) => m.id === moduleId);
    const video = db.videos.find((v) => v.moduleId === moduleId);
    if (!trainingModule || !video) notFound("Module");
    const checkpoints = db.checkpoints
      .filter((c) => c.videoId === video.id)
      .sort((a, b) => a.timestampSec - b.timestampSec);
    const ids = new Set(checkpoints.map((c) => c.id));
    const responses = db.checkpointResponses.filter((r) => r.userId === s.userId && ids.has(r.checkpointId));
    const progress =
      db.progress.find((p) => p.userId === s.userId && p.moduleId === moduleId) ?? emptyProgress(s.userId, moduleId);
    return delay(clone({ module: trainingModule, video, checkpoints, responses, progress }));
  }

  async submitCheckpointResponse(checkpointId: ID, optionId: ID) {
    const s = requireSession();
    simulateNetwork();
    const db = getDb();
    const checkpoint = db.checkpoints.find((c) => c.id === checkpointId);
    const video = checkpoint && db.videos.find((v) => v.id === checkpoint.videoId);
    if (!checkpoint || !video) notFound("Checkpoint");
    assertAssigned(s, video.moduleId);
    const option = checkpoint.options.find((o) => o.id === optionId);
    if (!option) throw new ServiceError("VALIDATION", "That answer option doesn't belong to this question.");

    // Idempotent: one answer per (learner, checkpoint) — the first one wins.
    const existing = db.checkpointResponses.find((r) => r.userId === s.userId && r.checkpointId === checkpointId);
    if (existing) {
      const firstOption = checkpoint.options.find((o) => o.id === existing.optionId) ?? option;
      return delay(
        clone({ response: existing, option: firstOption, generalRationale: checkpoint.generalRationale, alreadyAnswered: true }),
      );
    }

    const response = {
      id: newId("cr"),
      userId: s.userId,
      checkpointId,
      optionId,
      answeredAt: new Date().toISOString(),
    };
    updateDb((d) => {
      d.checkpointResponses.push(response);
    });
    return delay(clone({ response, option, generalRationale: checkpoint.generalRationale, alreadyAnswered: false }));
  }

  async saveProgress(moduleId: ID, update: ProgressUpdate) {
    const s = requireSession();
    simulateNetwork();
    assertAssigned(s, moduleId);
    const db = getDb();
    const duration = db.videos.find((v) => v.moduleId === moduleId)?.durationSec ?? Infinity;
    const clamp = (n: number) => Math.max(0, Math.min(Number.isFinite(n) ? n : 0, duration));

    let saved!: LearnerProgress;
    let started = false;
    updateDb((d) => {
      let p = d.progress.find((x) => x.userId === s.userId && x.moduleId === moduleId);
      if (!p) {
        p = emptyProgress(s.userId, moduleId);
        d.progress.push(p);
      }
      if (p.status === "NOT_STARTED") {
        p.status = "IN_PROGRESS";
        started = true;
      }
      p.lastPositionSec = clamp(update.positionSec);
      // The server never lets the furthest point move backwards.
      p.furthestSec = Math.max(p.furthestSec, clamp(update.furthestSec));
      if (update.videoCompleted) p.videoCompleted = true;
      p.updatedAt = new Date().toISOString();
      saved = p;
      if (started) {
        const user = d.users.find((u) => u.id === s.userId);
        const trainingModule = d.modules.find((m) => m.id === moduleId);
        d.activity.push({
          id: newId("act"),
          type: "MODULE_STARTED",
          actorId: s.userId,
          facilityId: s.facilityId,
          message: `${user?.name ?? "A learner"} started ${trainingModule?.title ?? "a module"}`,
          createdAt: p.updatedAt,
        });
      }
    });
    return delay(clone(saved));
  }

  // ── Demo tooling ────────────────────────────────────────
  async resetDemoData() {
    resetStore();
    return delay(undefined);
  }

  subscribe(listener: () => void) {
    return subscribe(listener);
  }
}
