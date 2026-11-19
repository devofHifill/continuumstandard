import type { ID, Session, User } from "@/lib/types";
import {
  ServiceError,
  type AssignmentRow,
  type AssignResult,
  type AttentionItem,
  type FacilityLearnerRow,
  type FacilitySummary,
  type LearnerInput,
  type LearnerReport,
} from "../service";
import { clone, delay, newId, notFound, randomToken, requireSession, simulateNetwork } from "./helpers";
import { buildDetail, buildItem } from "./learner";
import type { MockDb } from "./seed";
import { getDb, updateDb } from "./store";

/**
 * Mock facility-administration endpoints (F4).
 *
 * Tenant rule (docs/HLD_LLD_LEARNING.md §5.3): a Facility Admin only ever works on
 * their own facility — taken from the session, never trusted from the request.
 * A Super Admin may act on any facility but must say which (used by F5).
 */

const INVITE_TTL_DAYS = 7;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Which facility this request is about. Mismatches look like "not found". */
function resolveFacility(s: Session, facilityId?: ID): ID {
  if (s.role === "LEARNER") throw new ServiceError("FORBIDDEN", "Not allowed.");
  if (s.role === "FACILITY_ADMIN") {
    if (facilityId && facilityId !== s.facilityId) notFound("Facility");
    return s.facilityId!;
  }
  if (!facilityId) throw new ServiceError("VALIDATION", "Choose a facility.");
  if (!getDb().facilities.some((f) => f.id === facilityId)) notFound("Facility");
  return facilityId;
}

/** A learner this admin may manage: same facility (or any, for Super Admin). */
function managedLearner(s: Session, userId: ID): User {
  const user = getDb().users.find((u) => u.id === userId);
  const allowed =
    user && user.role === "LEARNER" && (s.role === "SUPER_ADMIN" || (s.role === "FACILITY_ADMIN" && user.facilityId === s.facilityId));
  if (!user || !allowed) notFound("Learner");
  return user;
}

function validateInput(input: LearnerInput, exceptUserId?: ID): LearnerInput {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const jobTitle = input.jobTitle?.trim() || undefined;
  if (!name) throw new ServiceError("VALIDATION", "Enter the learner's name.");
  if (name.length > 80) throw new ServiceError("VALIDATION", "Keep the name under 80 characters.");
  if (!EMAIL_RE.test(email)) throw new ServiceError("VALIDATION", "Enter a valid email address.");
  // Email is the sign-in identity, so it must be unique across the whole platform.
  if (getDb().users.some((u) => u.email.toLowerCase() === email && u.id !== exceptUserId)) {
    throw new ServiceError("VALIDATION", "That email address is already in use.");
  }
  return { name, email, jobTitle };
}

function actorName(db: MockDb, s: Session) {
  return db.users.find((u) => u.id === s.userId)?.name ?? "An administrator";
}

/** Issue a fresh invite link (replacing older unused ones) and "email" it. */
function issueInvite(d: MockDb, user: User) {
  const token = randomToken();
  d.authTokens = d.authTokens.filter((t) => !(t.userId === user.id && t.purpose === "INVITE" && !t.usedAt));
  d.authTokens.push({
    token,
    userId: user.id,
    purpose: "INVITE",
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
  });
  d.outbox.push({
    id: newId("mail"),
    to: user.email,
    subject: "You're invited to The Continuum-Standard",
    link: `/set-password?token=${token}`,
    createdAt: new Date().toISOString(),
  });
}

// ── Reads ─────────────────────────────────────────────────

/** Every assignment in a facility as a report row (the base for lists, progress and the summary). */
function assignmentRows(db: MockDb, facilityId: ID): AssignmentRow[] {
  const users = new Map(db.users.map((u) => [u.id, u]));
  return db.assignments
    .filter((a) => a.facilityId === facilityId)
    .flatMap((a) => {
      const learner = users.get(a.userId);
      const item = learner ? buildItem(db, a.userId, a.moduleId, a.assignedAt) : null;
      if (!learner || !item) return [];
      const row: AssignmentRow = {
        assignmentId: a.id,
        learner: { id: learner.id, name: learner.name, email: learner.email, status: learner.status, jobTitle: learner.jobTitle },
        module: { id: item.module.id, title: item.module.title, category: item.module.category },
        assignedAt: a.assignedAt,
        assignedByName: users.get(a.assignedById)?.name ?? "—",
        status: item.status,
        answeredCount: item.answeredCount,
        checkpointCount: item.checkpointCount,
        bestScorePercent: item.bestScorePercent,
        attemptsCount: item.attempts.length,
        passPercent: item.passPercent,
        lockedOut: item.nextStep === "LOCKED_OUT",
        completedAt: item.progress.completedAt,
      };
      return [row];
    })
    .sort((x, y) => y.assignedAt.localeCompare(x.assignedAt));
}

export async function getFacilitySummary(facilityId?: ID) {
  const s = requireSession();
  const fid = resolveFacility(s, facilityId);
  const db = getDb();
  const facility = db.facilities.find((f) => f.id === fid)!;
  const learners = db.users.filter((u) => u.facilityId === fid && u.role === "LEARNER");
  const rows = assignmentRows(db, fid);

  const count = (st: AssignmentRow["status"]) => rows.filter((r) => r.status === st).length;
  const scores = rows.filter((r) => r.bestScorePercent !== null).map((r) => r.bestScorePercent!);

  const attention: AttentionItem[] = [
    ...learners
      .filter((u) => u.status === "INVITED")
      .map((u) => ({ kind: "INVITE_PENDING" as const, userId: u.id, userName: u.name, detail: "Hasn't set up their account yet" })),
    ...rows
      .filter((r) => r.learner.status !== "DEACTIVATED" && r.lockedOut)
      .map((r) => ({
        kind: "LOCKED_OUT" as const,
        userId: r.learner.id,
        userName: r.learner.name,
        moduleTitle: r.module.title,
        detail: "Used all knowledge-check attempts",
      })),
    ...rows
      .filter((r) => r.learner.status !== "DEACTIVATED" && !r.lockedOut && r.status !== "COMPLETED" && r.attemptsCount > 0)
      .map((r) => ({
        kind: "FAILED_CHECK" as const,
        userId: r.learner.id,
        userName: r.learner.name,
        moduleTitle: r.module.title,
        detail: `Not passed yet — best ${r.bestScorePercent}% (pass ${r.passPercent}%)`,
      })),
  ];

  const summary: FacilitySummary = {
    facility,
    learners: {
      active: learners.filter((u) => u.status === "ACTIVE").length,
      invited: learners.filter((u) => u.status === "INVITED").length,
      deactivated: learners.filter((u) => u.status === "DEACTIVATED").length,
    },
    assignments: { total: rows.length, notStarted: count("NOT_STARTED"), inProgress: count("IN_PROGRESS"), completed: count("COMPLETED") },
    completionPercent: rows.length ? Math.round((count("COMPLETED") / rows.length) * 100) : 0,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    attention,
    recentActivity: db.activity
      .filter((a) => a.facilityId === fid)
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8),
  };
  return delay(clone(summary));
}

export async function listFacilityLearners(facilityId?: ID) {
  const s = requireSession();
  const fid = resolveFacility(s, facilityId);
  const db = getDb();
  const rows = assignmentRows(db, fid);
  const learners: FacilityLearnerRow[] = db.users
    .filter((u) => u.facilityId === fid && u.role === "LEARNER")
    .map((user) => {
      const mine = rows.filter((r) => r.learner.id === user.id);
      const last = db.activity
        .filter((a) => a.actorId === user.id)
        .reduce<string | null>((max, a) => (!max || a.createdAt > max ? a.createdAt : max), null);
      return {
        user,
        assigned: mine.length,
        notStarted: mine.filter((r) => r.status === "NOT_STARTED").length,
        inProgress: mine.filter((r) => r.status === "IN_PROGRESS").length,
        completed: mine.filter((r) => r.status === "COMPLETED").length,
        lastActivityAt: last,
      };
    })
    .sort((a, b) => a.user.name.localeCompare(b.user.name));
  return delay(clone(learners));
}

export async function listFacilityAssignments(facilityId?: ID) {
  const s = requireSession();
  const fid = resolveFacility(s, facilityId);
  return delay(clone(assignmentRows(getDb(), fid)));
}

export async function getLearnerReport(userId: ID) {
  const s = requireSession();
  if (s.role === "LEARNER") throw new ServiceError("FORBIDDEN", "Not allowed.");
  const learner = managedLearner(s, userId);
  const db = getDb();
  const items = db.assignments
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
    .map((a) => buildDetail(db, userId, a.moduleId))
    .filter((x) => x !== null);
  const report: LearnerReport = { learner, items };
  return delay(clone(report));
}

// ── Writes ────────────────────────────────────────────────

export async function createLearner(input: LearnerInput, facilityId?: ID) {
  const s = requireSession();
  simulateNetwork();
  const fid = resolveFacility(s, facilityId);
  const clean = validateInput(input);
  const user: User = {
    id: newId("usr"),
    role: "LEARNER",
    facilityId: fid,
    name: clean.name,
    email: clean.email,
    jobTitle: clean.jobTitle,
    status: "INVITED",
    createdAt: new Date().toISOString(),
  };
  updateDb((d) => {
    d.users.push(user);
    issueInvite(d, user);
    d.activity.push({
      id: newId("act"),
      type: "USER_CREATED",
      actorId: s.userId,
      facilityId: fid,
      message: `${actorName(d, s)} added learner ${user.name}`,
      createdAt: user.createdAt,
    });
  });
  return delay(clone(user));
}

export async function updateLearner(userId: ID, input: LearnerInput) {
  const s = requireSession();
  simulateNetwork();
  const existing = managedLearner(s, userId);
  const clean = validateInput(input, userId);
  // Admins manage learner emails (learners can't change their own — decision log #32).
  // A real system should confirm a changed address by email before switching sign-in to it.
  const emailChanged = clean.email !== existing.email.toLowerCase();
  updateDb((d) => {
    const u = d.users.find((x) => x.id === userId)!;
    u.name = clean.name;
    u.email = clean.email;
    u.jobTitle = clean.jobTitle;
    // An invite sent to the old address shouldn't keep working — send a new one.
    if (emailChanged && u.status === "INVITED") issueInvite(d, u);
  });
  return delay(clone(getDb().users.find((u) => u.id === userId)!));
}

export async function setLearnerActive(userId: ID, active: boolean) {
  const s = requireSession();
  simulateNetwork();
  const learner = managedLearner(s, userId);
  updateDb((d) => {
    const u = d.users.find((x) => x.id === userId)!;
    // Reactivating someone who never set a password puts them back to INVITED.
    const hasPassword = !!d.credentials[u.id];
    u.status = active ? (hasPassword ? "ACTIVE" : "INVITED") : "DEACTIVATED";
    d.activity.push({
      id: newId("act"),
      type: active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      actorId: s.userId,
      facilityId: learner.facilityId,
      message: `${actorName(d, s)} ${active ? "reactivated" : "deactivated"} ${u.name}`,
      createdAt: new Date().toISOString(),
    });
  });
  return delay(clone(getDb().users.find((u) => u.id === userId)!));
}

export async function resendInvite(userId: ID) {
  const s = requireSession();
  simulateNetwork();
  const learner = managedLearner(s, userId);
  if (learner.status !== "INVITED") {
    throw new ServiceError("VALIDATION", "This learner has already set up their account.");
  }
  updateDb((d) => {
    issueInvite(d, d.users.find((u) => u.id === userId)!);
    d.activity.push({
      id: newId("act"),
      type: "INVITE_SENT",
      actorId: s.userId,
      facilityId: learner.facilityId,
      message: `${actorName(d, s)} resent the invite to ${learner.name}`,
      createdAt: new Date().toISOString(),
    });
  });
  return delay(undefined);
}

export async function assignTraining(userIds: ID[], moduleIds: ID[]) {
  const s = requireSession();
  simulateNetwork();
  if (s.role === "LEARNER") throw new ServiceError("FORBIDDEN", "Not allowed.");
  if (!userIds.length) throw new ServiceError("VALIDATION", "Choose at least one learner.");
  if (!moduleIds.length) throw new ServiceError("VALIDATION", "Choose at least one module.");

  const db = getDb();
  const learners = [...new Set(userIds)].map((id) => managedLearner(s, id));
  const inactive = learners.filter((u) => u.status === "DEACTIVATED");
  if (inactive.length) {
    throw new ServiceError("VALIDATION", `${inactive.map((u) => u.name).join(", ")} is deactivated and can't be assigned training.`);
  }
  const modules = [...new Set(moduleIds)].map((id) => {
    const m = db.modules.find((x) => x.id === id);
    if (!m) notFound("Module");
    // Draft or disabled content can't be assigned by accident (scope doc §6.4).
    if (m.status !== "ACTIVE") throw new ServiceError("VALIDATION", `"${m.title}" isn't published, so it can't be assigned.`);
    return m;
  });

  const result: AssignResult = { created: 0, skipped: 0 };
  const now = new Date().toISOString();
  updateDb((d) => {
    for (const u of learners) {
      for (const m of modules) {
        // Idempotent: assigning the same module twice changes nothing.
        if (d.assignments.some((a) => a.userId === u.id && a.moduleId === m.id)) {
          result.skipped += 1;
          continue;
        }
        d.assignments.push({ id: newId("asg"), facilityId: u.facilityId!, userId: u.id, moduleId: m.id, assignedById: s.userId, assignedAt: now });
        result.created += 1;
      }
    }
    if (result.created) {
      d.activity.push({
        id: newId("act"),
        type: "MODULE_ASSIGNED",
        actorId: s.userId,
        facilityId: learners[0].facilityId,
        message: `${actorName(d, s)} assigned ${modules.length === 1 ? modules[0].title : `${modules.length} modules`} to ${
          learners.length === 1 ? learners[0].name : `${learners.length} learners`
        }`,
        createdAt: now,
      });
    }
  });
  return delay(result);
}
