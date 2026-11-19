import { beforeEach, describe, expect, it } from "vitest";
import type { ID } from "@/lib/types";
import { ServiceError } from "../service";
import { findByEmail, startSession } from "./helpers";
import { MockDataService } from "./mockService";
import { getDb, resetStore, updateDb } from "./store";

/**
 * Server-side rules of the learner endpoints, tested against the mock backend.
 * The real API must pass the same scenarios.
 */
const api = new MockDataService();
const MODULE = "mod-intake";

const signIn = (email: string) => startSession(findByEmail(email)!);

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof ServiceError ? e.code : "UNEXPECTED";
  }
}

/** Answer each question with the correct option for the first `rightCount` questions. */
function answers(rightCount: number): Record<ID, ID> {
  const a = getDb().assessments.find((x) => x.moduleId === MODULE)!;
  return Object.fromEntries(
    a.questions.map((q, i) => [q.id, q.options.find((o) => o.isCorrect === i < rightCount)!.id]),
  );
}

beforeEach(() => {
  resetStore();
  signIn("jordan@harborlight.test"); // assigned mod-intake, not started
});

describe("knowledge check access", () => {
  it("is locked until the scenario video has been watched", async () => {
    expect(await code(api.getMyAssessment(MODULE))).toBe("VALIDATION");
    await api.saveProgress(MODULE, { positionSec: 635, furthestSec: 635, videoCompleted: true });
    expect(await code(api.getMyAssessment(MODULE))).toBe("OK");
  });

  it("never sends the answer key or explanations to the browser", async () => {
    await api.saveProgress(MODULE, { positionSec: 635, furthestSec: 635, videoCompleted: true });
    const json = JSON.stringify(await api.getMyAssessment(MODULE));
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("feedback");
  });

  it("is only for assigned learners", async () => {
    expect(await code(api.getMyTraining("mod-ama"))).toBe("NOT_FOUND"); // not assigned to Jordan
    signIn("dana@harborlight.test"); // Facility Admin
    expect(await code(api.listMyTraining())).toBe("FORBIDDEN");
  });
});

describe("submitting", () => {
  beforeEach(async () => {
    await api.saveProgress(MODULE, { positionSec: 635, furthestSec: 635, videoCompleted: true });
  });

  it("rejects incomplete answers", async () => {
    const partial = Object.fromEntries(Object.entries(answers(5)).slice(0, 2));
    expect(await code(api.submitAssessment(MODULE, partial))).toBe("VALIDATION");
  });

  it("a fail keeps the module in progress and hides the correct answers", async () => {
    const r = await api.submitAssessment(MODULE, answers(3));
    expect(r.attempt).toMatchObject({ scorePercent: 60, passed: false });
    expect(r.answersRevealed).toBe(false);
    expect(r.review.every((x) => x.correctLabel === undefined)).toBe(true);
    const [item] = await api.listMyTraining();
    expect(item.status).toBe("IN_PROGRESS");
    expect(item.nextStep).toBe("TAKE_ASSESSMENT");
  });

  it("a pass completes the module, reveals answers and blocks retakes", async () => {
    const r = await api.submitAssessment(MODULE, answers(5));
    expect(r.attempt.passed).toBe(true);
    expect(r.answersRevealed).toBe(true);
    const [item] = await api.listMyTraining();
    expect(item.status).toBe("COMPLETED");
    expect(item.nextStep).toBe("REVIEW");
    expect(await code(api.getMyAssessment(MODULE))).toBe("VALIDATION");
  });

  it("respects an attempt limit (D6) and locks out when it's used up", async () => {
    updateDb((d) => {
      d.assessments.find((a) => a.moduleId === MODULE)!.maxAttempts = 1;
    });
    const r = await api.submitAssessment(MODULE, answers(1));
    expect(r.attemptsRemaining).toBe(0);
    expect(r.answersRevealed).toBe(true); // can't help a retry any more
    expect(await code(api.submitAssessment(MODULE, answers(5)))).toBe("VALIDATION");
    const [item] = await api.listMyTraining();
    expect(item.nextStep).toBe("LOCKED_OUT");
  });
});
