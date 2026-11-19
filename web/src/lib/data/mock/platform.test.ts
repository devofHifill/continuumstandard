import { beforeEach, describe, expect, it } from "vitest";
import { ServiceError } from "../service";
import { findByEmail, startSession } from "./helpers";
import { MockDataService } from "./mockService";
import { getDb, resetStore } from "./store";

/** Super Admin and content rules (F5), tested against the mock backend. */
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
  signIn("super@continuum.test");
});

describe("access", () => {
  it("is Super Admin only", async () => {
    signIn("dana@harborlight.test");
    expect(await code(api.getPlatformSummary())).toBe("FORBIDDEN");
    expect(await code(api.listModuleRows())).toBe("FORBIDDEN");
    expect(await code(api.createFacility({ name: "X", contactName: "Y", contactEmail: "y@x.test" }))).toBe("FORBIDDEN");
  });
});

describe("facilities and their admins", () => {
  it("creates a facility, then an invited Facility Admin for it", async () => {
    const f = await api.createFacility({ name: "Lakeside Program", contactName: "Lee", contactEmail: "lee@lakeside.test" });
    expect(f.isActive).toBe(true);
    expect(await code(api.createFacility({ name: "lakeside program", contactName: "A", contactEmail: "a@b.test" }))).toBe("VALIDATION");
    const admin = await api.createFacilityAdmin({ name: "Lee Admin", email: "lee.admin@lakeside.test", facilityId: f.id });
    expect(admin).toMatchObject({ role: "FACILITY_ADMIN", status: "INVITED", facilityId: f.id });
    expect(getDb().outbox.at(-1)!.to).toBe("lee.admin@lakeside.test");
  });

  it("switching a facility off ends its users' sessions", async () => {
    await api.setFacilityActive("fac-harbor", false);
    signIn("taylor@pinecrest.test"); // other facility still works
    signIn("super@continuum.test");
    expect(() => signIn("dana@harborlight.test")).toThrow();
  });

  it("reset access emails an active admin a reset link; invited admins get an invite instead", async () => {
    await api.sendAdminPasswordReset("usr-h-admin");
    expect(getDb().outbox.at(-1)!.link).toMatch(/^\/reset-password\?token=/);
    const f = await api.createFacilityAdmin({ name: "New", email: "new.admin@harborlight.test", facilityId: "fac-harbor" });
    expect(await code(api.sendAdminPasswordReset(f.id))).toBe("VALIDATION");
    expect(await code(api.resendAdminInvite(f.id))).toBe("OK");
  });
});

describe("content", () => {
  const details = {
    title: "New Module",
    description: "Desc",
    category: "Cat",
    learningObjectives: ["One"],
    thumbnailUrl: "/thumbnails/mod-ama.svg",
    estimatedMinutes: 10,
  };

  it("builds a module from draft to published", async () => {
    const m = await api.createModule(details);
    expect(m.status).toBe("DRAFT");
    expect(await code(api.setModuleStatus(m.id, "ACTIVE"))).toBe("VALIDATION"); // nothing added yet
    expect(await code(api.saveCheckpoints(m.id, []))).toBe("VALIDATION"); // no video yet

    await api.saveModuleVideo(m.id, { sourceUrl: "https://stream.test/v.m3u8", durationSec: 300 });
    await api.saveCheckpoints(m.id, [
      { id: "new-1", timestampSec: 30, prompt: "What now?", generalRationale: "Why.", options: [{ id: "new-a", label: "A" }, { id: "new-b", label: "B" }] },
    ]);
    await api.saveAssessment(m.id, {
      passPercent: 80,
      maxAttempts: 3,
      questions: [{ id: "new-q", text: "Q?", options: [{ id: "new-x", label: "X", isCorrect: true }, { id: "new-y", label: "Y", isCorrect: false }] }],
    });
    const b = await api.getModuleForEdit(m.id);
    expect(b.publishProblems).toEqual([]);
    expect(b.checkpoints[0].id).not.toMatch(/^new-/); // real ids assigned
    expect((await api.setModuleStatus(m.id, "ACTIVE")).status).toBe("ACTIVE");
  });

  it("rejects unsafe media links", async () => {
    const m = await api.createModule(details);
    expect(await code(api.saveModuleVideo(m.id, { sourceUrl: "javascript:alert(1)", durationSec: 60 }))).toBe("VALIDATION");
  });

  it("won't delete a decision point or option learners already answered", async () => {
    const b = await api.getModuleForEdit("mod-intake"); // Alex answered cp-intake-1 with option b
    const withoutFirst = b.checkpoints.filter((c) => c.id !== "cp-intake-1");
    expect(await code(api.saveCheckpoints("mod-intake", withoutFirst))).toBe("VALIDATION");
    const dropChosen = b.checkpoints.map((c) =>
      c.id === "cp-intake-1" ? { ...c, options: c.options.filter((o) => o.id !== "cp-intake-1-opt-b") } : c,
    );
    expect(await code(api.saveCheckpoints("mod-intake", dropChosen))).toBe("VALIDATION");
    // Editing wording and moving the time is fine.
    const reworded = b.checkpoints.map((c) => ({ ...c, prompt: `${c.prompt} (edited)` }));
    expect(await code(api.saveCheckpoints("mod-intake", reworded))).toBe("OK");
  });

  it("an assigned module can be disabled but not sent back to draft", async () => {
    expect(await code(api.setModuleStatus("mod-intake", "DRAFT"))).toBe("VALIDATION");
    expect((await api.setModuleStatus("mod-intake", "DISABLED")).status).toBe("DISABLED");
    // Disabled modules can't be newly assigned…
    signIn("dana@harborlight.test");
    expect(await code(api.assignTraining(["usr-h-l3"], ["mod-intake"]))).toBe("VALIDATION");
    // …but learners who already have it keep access.
    signIn("alex@harborlight.test");
    expect(await code(api.getPlayback("mod-intake"))).toBe("OK");
  });
});
