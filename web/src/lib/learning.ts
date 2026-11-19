import type { AssessmentAttempt, ID, KnowledgeAssessment, LearnerProgress, ProgressStatus } from "@/lib/types";

/**
 * Learning rules shared by the mock backend and the UI — pure functions, unit-tested.
 * The real API must apply the same rules on the server.
 */

export interface ScoreResult {
  correctCount: number;
  total: number;
  scorePercent: number;
  passed: boolean;
  /** questionId → whether the chosen option was correct */
  correctness: Record<ID, boolean>;
}

/** Score a knowledge-check attempt. Unanswered questions count as wrong. */
export function scoreAttempt(assessment: KnowledgeAssessment, answers: Record<ID, ID>): ScoreResult {
  const correctness: Record<ID, boolean> = {};
  let correctCount = 0;
  for (const q of assessment.questions) {
    const chosen = q.options.find((o) => o.id === answers[q.id]);
    const ok = !!chosen?.isCorrect;
    correctness[q.id] = ok;
    if (ok) correctCount += 1;
  }
  const total = assessment.questions.length;
  const scorePercent = total ? Math.round((correctCount / total) * 100) : 0;
  return { correctCount, total, scorePercent, passed: scorePercent >= assessment.passPercent, correctness };
}

/** Attempts left, or null for unlimited (decision D6). 0 means no more attempts. */
export function attemptsRemaining(assessment: Pick<KnowledgeAssessment, "maxAttempts">, used: number) {
  return assessment.maxAttempts === null ? null : Math.max(0, assessment.maxAttempts - used);
}

/**
 * A module is COMPLETED only when the video has been watched AND the knowledge check
 * is passed (decision log #22). A module without a knowledge check completes on video end.
 */
export function deriveStatus(
  progress: Pick<LearnerProgress, "status" | "videoCompleted"> | undefined,
  hasAssessment: boolean,
  attempts: Pick<AssessmentAttempt, "passed">[],
): ProgressStatus {
  const passed = attempts.some((a) => a.passed);
  if (progress?.videoCompleted && (passed || !hasAssessment)) return "COMPLETED";
  if (!progress || (progress.status === "NOT_STARTED" && attempts.length === 0)) return "NOT_STARTED";
  return "IN_PROGRESS";
}

export type NextStep = "START" | "CONTINUE_VIDEO" | "TAKE_ASSESSMENT" | "LOCKED_OUT" | "REVIEW";

/** What the learner's main button should do for a module. */
export function nextStep(input: {
  status: ProgressStatus;
  videoCompleted: boolean;
  hasAssessment: boolean;
  attemptsRemaining: number | null;
}): NextStep {
  if (input.status === "COMPLETED") return "REVIEW";
  if (input.status === "NOT_STARTED") return "START";
  if (!input.videoCompleted || !input.hasAssessment) return "CONTINUE_VIDEO";
  return input.attemptsRemaining === 0 ? "LOCKED_OUT" : "TAKE_ASSESSMENT";
}

export const STEP_LABEL: Record<NextStep, string> = {
  START: "Start training",
  CONTINUE_VIDEO: "Continue",
  TAKE_ASSESSMENT: "Take knowledge check",
  LOCKED_OUT: "View details",
  REVIEW: "Review",
};

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};
