import { describe, expect, it } from "vitest";
import type { KnowledgeAssessment } from "@/lib/types";
import { attemptsRemaining, deriveStatus, nextStep, scoreAttempt } from "./learning";

const assessment: KnowledgeAssessment = {
  id: "a",
  moduleId: "m",
  passPercent: 80,
  maxAttempts: null,
  questions: Array.from({ length: 5 }, (_, i) => ({
    id: `q${i}`,
    text: "?",
    options: [
      { id: `q${i}-right`, label: "right", isCorrect: true },
      { id: `q${i}-wrong`, label: "wrong", isCorrect: false },
    ],
  })),
};

const answer = (rightCount: number) =>
  Object.fromEntries(assessment.questions.map((q, i) => [q.id, i < rightCount ? `${q.id}-right` : `${q.id}-wrong`]));

describe("scoreAttempt", () => {
  it("scores 4/5 as 80% and passes at an 80% pass mark", () => {
    const r = scoreAttempt(assessment, answer(4));
    expect(r).toMatchObject({ correctCount: 4, total: 5, scorePercent: 80, passed: true });
    expect(r.correctness).toMatchObject({ q0: true, q4: false });
  });
  it("fails below the pass mark", () => {
    expect(scoreAttempt(assessment, answer(3))).toMatchObject({ scorePercent: 60, passed: false });
  });
  it("counts unanswered or unknown options as wrong", () => {
    expect(scoreAttempt(assessment, { q0: "q0-right", q1: "not-an-option" }).correctCount).toBe(1);
  });
});

describe("attemptsRemaining (D6)", () => {
  it("is unlimited when maxAttempts is null", () => {
    expect(attemptsRemaining({ maxAttempts: null }, 7)).toBeNull();
  });
  it("counts down and never goes negative", () => {
    expect(attemptsRemaining({ maxAttempts: 3 }, 1)).toBe(2);
    expect(attemptsRemaining({ maxAttempts: 3 }, 5)).toBe(0);
  });
});

describe("deriveStatus", () => {
  const watched = { status: "IN_PROGRESS" as const, videoCompleted: true };
  it("is not started with no progress", () => {
    expect(deriveStatus(undefined, true, [])).toBe("NOT_STARTED");
  });
  it("stays in progress after the video until the check is passed", () => {
    expect(deriveStatus(watched, true, [])).toBe("IN_PROGRESS");
    expect(deriveStatus(watched, true, [{ passed: false }])).toBe("IN_PROGRESS");
  });
  it("completes when video watched and check passed", () => {
    expect(deriveStatus(watched, true, [{ passed: false }, { passed: true }])).toBe("COMPLETED");
  });
  it("completes on video end when there is no knowledge check", () => {
    expect(deriveStatus(watched, false, [])).toBe("COMPLETED");
  });
});

describe("nextStep", () => {
  const base = { videoCompleted: false, hasAssessment: true, attemptsRemaining: null };
  it("walks start → continue → assessment → review", () => {
    expect(nextStep({ ...base, status: "NOT_STARTED" })).toBe("START");
    expect(nextStep({ ...base, status: "IN_PROGRESS" })).toBe("CONTINUE_VIDEO");
    expect(nextStep({ ...base, status: "IN_PROGRESS", videoCompleted: true })).toBe("TAKE_ASSESSMENT");
    expect(nextStep({ ...base, status: "COMPLETED", videoCompleted: true })).toBe("REVIEW");
  });
  it("locks out when no attempts remain", () => {
    expect(nextStep({ ...base, status: "IN_PROGRESS", videoCompleted: true, attemptsRemaining: 0 })).toBe("LOCKED_OUT");
  });
});
