import { beforeEach, describe, expect, it } from "vitest";
import { ServiceError } from "../service";
import { findByEmail, startSession } from "./helpers";
import { MockDataService } from "./mockService";
import { getDb, resetStore } from "./store";

/** Facility-admin rules (F4), tested against the mock backend — the contract for the real API. */
const api = new MockDataService();
const signIn = (email: string) => startSession(findByEmail(email)!);

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof ServiceError ? e.code : "UNEXPECTED";
  }
}

beforeEach(() => {
  resetStore();
  signIn("dana@harborlight.test"); // Facility Admin, Harbor Light
});

describe("tenant isolation", () => {
  it("only lists the admin's own facility", async () => {
    const learners = await api.listFacilityLearners();
    expect(learners.every((l) => l.user.facilityId === "fac-harbor")).toBe(true);
    const rows = await api.listFacilityAssignments();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.learner.id.startsWith("usr-p-"))).toBe(false);
  });

  it("treats another facility's learner as not found (404, not 403)", async () => {
    expect(await code(api.getLearnerReport("usr-p-l1"))).toBe("NOT_FOUND");
    expect(await code(api.setLearnerActive("usr-p-l1", false))).toBe("NOT_FOUND");
    expect(await code(api.assignTraining(["usr-p-l1"], ["mod-intake"]))).toBe("NOT_FOUND");
    expect(await code(api.listFacilityLearners("fac-pinecrest"))).toBe("NOT_FOUND");
  });

  it("can't manage admins, only learners", async () => {
    expect(await code(api.setLearnerActive("usr-h-admin2", false))).toBe("NOT_FOUND");
  });

  it("learners can't use admin endpoints", async () => {
    signIn("alex@harborlight.test");
    expect(await code(api.listFacilityLearners())).toBe("FORBIDDEN");
  });

  it("a Super Admin must say which facility", async () => {
    signIn("super@continuum.test");
    expect(await code(api.listFacilityLearners())).toBe("VALIDATION");
    expect(await code(api.listFacilityLearners("fac-pinecrest"))).toBe("OK");
  });
});

describe("learner accounts", () => {
  it("creates an invited learner in the admin's facility and emails an invite", async () => {
    const u = await api.createLearner({ name: " New Person ", email: "New@Harborlight.test" });
    expect(u).toMatchObject({ name: "New Person", email: "new@harborlight.test", status: "INVITED", facilityId: "fac-harbor" });
    const mail = getDb().outbox.at(-1)!;
    expect(mail.to).toBe("new@harborlight.test");
    expect(mail.link).toMatch(/^\/set-password\?token=/);
  });

  it("rejects duplicate emails across the platform", async () => {
    expect(await code(api.createLearner({ name: "X", email: "taylor@pinecrest.test" }))).toBe("VALIDATION");
  });

  it("deactivation blocks sign-in but keeps history; reactivation restores it", async () => {
    const before = (await api.getLearnerReport("usr-h-l1")).items.length;
    await api.setLearnerActive("usr-h-l1", false);
    expect(await code(api.login("alex@harborlight.test", "anything"))).not.toBe("OK");
    expect((await api.getLearnerReport("usr-h-l1")).items.length).toBe(before);
    expect((await api.setLearnerActive("usr-h-l1", true)).status).toBe("ACTIVE");
  });

  it("resending an invite replaces the old link", async () => {
    const old = getDb().authTokens.find((t) => t.userId === "usr-h-l4" && t.purpose === "INVITE")!.token;
    await api.resendInvite("usr-h-l4");
    expect(await code(api.checkAuthToken(old, "INVITE"))).toBe("VALIDATION");
    expect(await code(api.resendInvite("usr-h-l1"))).toBe("VALIDATION"); // already active
  });
});

describe("assigning training (D3)", () => {
  it("assigns every module to every learner and skips existing pairs", async () => {
    const r = await api.assignTraining(["usr-h-l1", "usr-h-l3"], ["mod-intake", "mod-ama"]);
    // Alex already has both, Priya already has mod-ama → only Priya + mod-intake is new.
    expect(r).toEqual({ created: 1, skipped: 3 });
    const again = await api.assignTraining(["usr-h-l3"], ["mod-intake"]);
    expect(again).toEqual({ created: 0, skipped: 1 });
  });

  it("refuses draft modules and deactivated learners", async () => {
    expect(await code(api.assignTraining(["usr-h-l2"], ["mod-boundaries"]))).toBe("VALIDATION");
    expect(await code(api.assignTraining(["usr-h-l5"], ["mod-intake"]))).toBe("VALIDATION");
  });

  it("a new assignment shows up for the learner", async () => {
    await api.assignTraining(["usr-h-l3"], ["mod-intake"]);
    signIn("priya@harborlight.test");
    const mine = await api.listMyTraining();
    expect(mine.map((i) => i.module.id).sort()).toEqual(["mod-ama", "mod-intake"]);
  });
});

describe("facility summary", () => {
  it("counts learners and assignment status for the facility", async () => {
    const s = await api.getFacilitySummary();
    expect(s.facility.id).toBe("fac-harbor");
    expect(s.learners).toEqual({ active: 3, invited: 1, deactivated: 1 });
    expect(s.assignments.total).toBe(4);
    expect(s.attention.some((a) => a.kind === "INVITE_PENDING" && a.userName === "Chris Park")).toBe(true);
  });
});
