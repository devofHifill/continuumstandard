import type { Facility, ID, Session, User } from "@/lib/types";
import { ServiceError, type AdminInput, type AdminRow, type FacilityInput, type FacilityRow, type PlatformSummary } from "../service";
import { actorName, assignmentRows, issueInvite, validateInput } from "./facility";
import { clone, delay, newId, notFound, randomToken, requireSession, simulateNetwork } from "./helpers";
import type { MockDb } from "./seed";
import { getDb, updateDb } from "./store";

/** Mock platform-administration endpoints (F5). Super Admin only. */

export function requireSuperAdmin(): Session {
  const s = requireSession();
  if (s.role !== "SUPER_ADMIN") throw new ServiceError("FORBIDDEN", "Only platform administrators can do this.");
  return s;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function cleanFacility(input: FacilityInput, exceptId?: ID): FacilityInput {
  const name = input.name.trim();
  const contactName = input.contactName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  const phone = input.phone?.trim() || undefined;
  if (!name) throw new ServiceError("VALIDATION", "Enter the facility name.");
  if (name.length > 120) throw new ServiceError("VALIDATION", "Keep the name under 120 characters.");
  if (getDb().facilities.some((f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== exceptId)) {
    throw new ServiceError("VALIDATION", "A facility with this name already exists.");
  }
  if (!contactName) throw new ServiceError("VALIDATION", "Enter a contact name.");
  if (!EMAIL_RE.test(contactEmail)) throw new ServiceError("VALIDATION", "Enter a valid contact email.");
  return { name, contactName, contactEmail, phone };
}

function facilityRow(db: MockDb, facility: Facility): FacilityRow {
  const rows = assignmentRows(db, facility.id);
  const done = rows.filter((r) => r.status === "COMPLETED").length;
  return {
    facility,
    admins: db.users.filter((u) => u.facilityId === facility.id && u.role === "FACILITY_ADMIN" && u.status !== "DEACTIVATED").length,
    learners: db.users.filter((u) => u.facilityId === facility.id && u.role === "LEARNER" && u.status !== "DEACTIVATED").length,
    assignments: rows.length,
    completionPercent: rows.length ? Math.round((done / rows.length) * 100) : 0,
  };
}

function managedAdmin(id: ID): User {
  const u = getDb().users.find((x) => x.id === id && x.role === "FACILITY_ADMIN");
  if (!u) notFound("Facility Admin");
  return u;
}

export function log(d: MockDb, s: Session, type: MockDb["activity"][number]["type"], facilityId: ID | null, message: string) {
  d.activity.push({ id: newId("act"), type, actorId: s.userId, facilityId, message, createdAt: new Date().toISOString() });
}

// ── Summary & facilities ──────────────────────────────────

export async function getPlatformSummary() {
  requireSuperAdmin();
  const db = getDb();
  const facilityRows = db.facilities.map((f) => facilityRow(db, f));
  const total = facilityRows.reduce((n, r) => n + r.assignments, 0);
  const completed = db.facilities.reduce(
    (n, f) => n + assignmentRows(db, f.id).filter((r) => r.status === "COMPLETED").length,
    0,
  );
  const learners = db.users.filter((u) => u.role === "LEARNER");
  const summary: PlatformSummary = {
    facilities: { active: db.facilities.filter((f) => f.isActive).length, inactive: db.facilities.filter((f) => !f.isActive).length },
    learners: { active: learners.filter((u) => u.status === "ACTIVE").length, invited: learners.filter((u) => u.status === "INVITED").length },
    admins: db.users.filter((u) => u.role === "FACILITY_ADMIN" && u.status !== "DEACTIVATED").length,
    modules: {
      active: db.modules.filter((m) => m.status === "ACTIVE").length,
      draft: db.modules.filter((m) => m.status === "DRAFT").length,
      disabled: db.modules.filter((m) => m.status === "DISABLED").length,
    },
    assignments: { total, completed },
    completionPercent: total ? Math.round((completed / total) * 100) : 0,
    leads: db.leads.length,
    facilityRows,
    recentActivity: [...db.activity].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
  };
  return delay(clone(summary));
}

export async function listFacilityRows() {
  requireSuperAdmin();
  const db = getDb();
  const rows = db.facilities.map((f) => facilityRow(db, f)).sort((a, b) => a.facility.name.localeCompare(b.facility.name));
  return delay(clone(rows));
}

export async function createFacility(input: FacilityInput) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const clean = cleanFacility(input);
  const facility: Facility = { id: newId("fac"), ...clean, isActive: true, createdAt: new Date().toISOString() };
  updateDb((d) => {
    d.facilities.push(facility);
    log(d, s, "FACILITY_CREATED", facility.id, `Facility ${facility.name} created`);
  });
  return delay(clone(facility));
}

export async function updateFacility(id: ID, input: FacilityInput) {
  requireSuperAdmin();
  simulateNetwork();
  if (!getDb().facilities.some((f) => f.id === id)) notFound("Facility");
  const clean = cleanFacility(input, id);
  updateDb((d) => {
    Object.assign(d.facilities.find((f) => f.id === id)!, clean);
  });
  return delay(clone(getDb().facilities.find((f) => f.id === id)!));
}

export async function setFacilityActive(id: ID, active: boolean) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const f = getDb().facilities.find((x) => x.id === id);
  if (!f) notFound("Facility");
  updateDb((d) => {
    d.facilities.find((x) => x.id === id)!.isActive = active;
    log(d, s, active ? "FACILITY_REACTIVATED" : "FACILITY_DEACTIVATED", id, `Facility ${f.name} ${active ? "reactivated" : "deactivated"}`);
  });
  return delay(clone(getDb().facilities.find((x) => x.id === id)!));
}

// ── Facility Admins ───────────────────────────────────────

export async function listFacilityAdmins() {
  requireSuperAdmin();
  const db = getDb();
  const fac = new Map(db.facilities.map((f) => [f.id, f]));
  const rows: AdminRow[] = db.users
    .filter((u) => u.role === "FACILITY_ADMIN")
    .map((user) => ({
      user,
      facilityName: fac.get(user.facilityId!)?.name ?? "—",
      facilityActive: fac.get(user.facilityId!)?.isActive ?? false,
    }))
    .sort((a, b) => a.facilityName.localeCompare(b.facilityName) || a.user.name.localeCompare(b.user.name));
  return delay(clone(rows));
}

export async function createFacilityAdmin(input: AdminInput) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const facility = getDb().facilities.find((f) => f.id === input.facilityId);
  if (!facility) throw new ServiceError("VALIDATION", "Choose a facility.");
  const clean = validateInput(input);
  const user: User = {
    id: newId("usr"),
    role: "FACILITY_ADMIN",
    facilityId: facility.id,
    name: clean.name,
    email: clean.email,
    jobTitle: clean.jobTitle,
    status: "INVITED",
    createdAt: new Date().toISOString(),
  };
  updateDb((d) => {
    d.users.push(user);
    issueInvite(d, user);
    log(d, s, "USER_CREATED", facility.id, `${actorName(d, s)} added Facility Admin ${user.name} (${facility.name})`);
  });
  return delay(clone(user));
}

export async function updateFacilityAdmin(id: ID, input: Omit<AdminInput, "facilityId">) {
  requireSuperAdmin();
  simulateNetwork();
  const existing = managedAdmin(id);
  const clean = validateInput(input, id);
  const emailChanged = clean.email !== existing.email.toLowerCase();
  updateDb((d) => {
    const u = d.users.find((x) => x.id === id)!;
    u.name = clean.name;
    u.email = clean.email;
    u.jobTitle = clean.jobTitle;
    if (emailChanged && u.status === "INVITED") issueInvite(d, u);
  });
  return delay(clone(getDb().users.find((u) => u.id === id)!));
}

export async function setAdminActive(id: ID, active: boolean) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const admin = managedAdmin(id);
  updateDb((d) => {
    const u = d.users.find((x) => x.id === id)!;
    u.status = active ? (d.credentials[u.id] ? "ACTIVE" : "INVITED") : "DEACTIVATED";
    log(d, s, active ? "USER_REACTIVATED" : "USER_DEACTIVATED", admin.facilityId, `${actorName(d, s)} ${active ? "reactivated" : "deactivated"} Facility Admin ${u.name}`);
  });
  return delay(clone(getDb().users.find((u) => u.id === id)!));
}

export async function resendAdminInvite(id: ID) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const admin = managedAdmin(id);
  if (admin.status !== "INVITED") throw new ServiceError("VALIDATION", "This admin has already set up their account.");
  updateDb((d) => {
    issueInvite(d, d.users.find((u) => u.id === id)!);
    log(d, s, "INVITE_SENT", admin.facilityId, `${actorName(d, s)} resent the invite to ${admin.name}`);
  });
  return delay(undefined);
}

export async function sendAdminPasswordReset(id: ID) {
  requireSuperAdmin();
  simulateNetwork();
  const admin = managedAdmin(id);
  if (admin.status !== "ACTIVE") {
    throw new ServiceError("VALIDATION", admin.status === "INVITED" ? "Resend the invite instead." : "Reactivate this admin first.");
  }
  updateDb((d) => {
    const token = randomToken();
    d.authTokens = d.authTokens.filter((t) => !(t.userId === id && t.purpose === "RESET" && !t.usedAt));
    d.authTokens.push({ token, userId: id, purpose: "RESET", expiresAt: new Date(Date.now() + 60 * 60_000).toISOString() });
    d.outbox.push({
      id: newId("mail"),
      to: admin.email,
      subject: "Reset your Continuum-Standard password",
      link: `/reset-password?token=${token}`,
      createdAt: new Date().toISOString(),
    });
  });
  return delay(undefined);
}

// ── Activity & leads ──────────────────────────────────────

export async function listActivity(filter: { facilityId?: ID; type?: MockDb["activity"][number]["type"]; limit?: number } = {}) {
  requireSuperAdmin();
  const rows = [...getDb().activity]
    .reverse()
    .filter((a) => (!filter.facilityId || a.facilityId === filter.facilityId) && (!filter.type || a.type === filter.type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, filter.limit ?? 200);
  return delay(clone(rows));
}

export async function listLeads() {
  requireSuperAdmin();
  const rows = [...getDb().leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(clone(rows));
}
