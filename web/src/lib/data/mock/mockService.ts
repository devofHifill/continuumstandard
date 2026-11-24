import type { ID, LearnerProgress, User } from "@/lib/types";
import { validatePassword } from "@/lib/auth/password";
import { ServiceError, type AuthTokenPurpose, type DataService, type ProgressUpdate } from "../service";
import {
  assertAssigned,
  clone,
  delay,
  emptyProgress,
  findByEmail,
  inMinutes,
  inScope,
  newId,
  notFound,
  randomToken,
  requireSession,
  RESET_TTL_MIN,
  sessionProblem,
  simulateNetwork,
  startSession,
  toSession,
  validToken,
} from "./helpers";
import * as content from "./content";
import * as facility from "./facility";
import * as learner from "./learner";
import * as platform from "./platform";
import * as publicSite from "./publicSite";
import { getDb, getStoredSession, resetStore, setStoredSession, subscribe, updateDb } from "./store";

export { findByEmail, startSession } from "./helpers";

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
      // A module with no knowledge check is complete as soon as the video is watched.
      const hasCheck = d.assessments.some((a) => a.moduleId === moduleId && a.questions.length > 0);
      if (p.videoCompleted && !hasCheck && p.status !== "COMPLETED") {
        p.status = "COMPLETED";
        p.completedAt = new Date().toISOString();
      }
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

  // ── Learner (F3) — implemented in ./learner.ts ──────────
  listMyTraining = learner.listMyTraining;
  getMyTraining = learner.getMyTraining;
  getMyAssessment = learner.getMyAssessment;
  submitAssessment = learner.submitAssessment;
  listMyActivity = learner.listMyActivity;

  // ── Facility administration (F4) — implemented in ./facility.ts ──
  getFacilitySummary = facility.getFacilitySummary;
  listFacilityLearners = facility.listFacilityLearners;
  createLearner = facility.createLearner;
  updateLearner = facility.updateLearner;
  setLearnerActive = facility.setLearnerActive;
  resendInvite = facility.resendInvite;
  assignTraining = facility.assignTraining;
  listFacilityAssignments = facility.listFacilityAssignments;
  getLearnerReport = facility.getLearnerReport;

  // ── Public website (F6) — ./publicSite.ts ───────────────
  submitDemoRequest = publicSite.submitDemoRequest;

  // ── Platform administration (F5) — ./platform.ts ────────
  getPlatformSummary = platform.getPlatformSummary;
  listFacilityRows = platform.listFacilityRows;
  createFacility = platform.createFacility;
  updateFacility = platform.updateFacility;
  setFacilityActive = platform.setFacilityActive;
  listFacilityAdmins = platform.listFacilityAdmins;
  createFacilityAdmin = platform.createFacilityAdmin;
  updateFacilityAdmin = platform.updateFacilityAdmin;
  setAdminActive = platform.setAdminActive;
  resendAdminInvite = platform.resendAdminInvite;
  sendAdminPasswordReset = platform.sendAdminPasswordReset;
  listActivity = platform.listActivity;
  listLeads = platform.listLeads;

  // ── Training content (F5) — ./content.ts ────────────────
  listModuleRows = content.listModuleRows;
  getModuleForEdit = content.getModuleForEdit;
  createModule = content.createModule;
  updateModuleDetails = content.updateModuleDetails;
  saveModuleVideo = content.saveModuleVideo;
  saveCheckpoints = content.saveCheckpoints;
  saveAssessment = content.saveAssessment;
  setModuleStatus = content.setModuleStatus;

  // ── Demo tooling ────────────────────────────────────────
  async resetDemoData() {
    resetStore();
    return delay(undefined);
  }

  subscribe(listener: () => void) {
    return subscribe(listener);
  }
}
