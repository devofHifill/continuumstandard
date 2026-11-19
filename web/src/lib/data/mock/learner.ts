import { attemptsRemaining, deriveStatus, nextStep, scoreAttempt } from "@/lib/learning";
import type { ID, KnowledgeAssessment, Session } from "@/lib/types";
import {
  ServiceError,
  type AssessmentResult,
  type AttemptSummary,
  type LearnerAssessment,
  type MyTrainingDetail,
  type MyTrainingItem,
} from "../service";
import { assertAssigned, clone, delay, emptyProgress, newId, notFound, requireSession, simulateNetwork } from "./helpers";
import type { MockDb } from "./seed";
import { getDb, updateDb } from "./store";

/**
 * Mock learner endpoints (F3). Mirrors what the real API will do:
 * every function starts from the signed-in learner and only touches their own records.
 */

function requireLearner(): Session {
  const s = requireSession();
  if (s.role !== "LEARNER") throw new ServiceError("FORBIDDEN", "Only learners have assigned training.");
  return s;
}

const summary = (a: { id: ID; scorePercent: number; passed: boolean; submittedAt: string }): AttemptSummary => ({
  id: a.id,
  scorePercent: a.scorePercent,
  passed: a.passed,
  submittedAt: a.submittedAt,
});

/** Build one training row — the "view model" a card or page needs, computed server-side. */
function buildItem(db: MockDb, userId: ID, moduleId: ID, assignedAt: string): MyTrainingItem | null {
  const mod = db.modules.find((m) => m.id === moduleId);
  if (!mod) return null;
  const video = db.videos.find((v) => v.moduleId === moduleId);
  const checkpointIds = new Set(db.checkpoints.filter((c) => c.videoId === video?.id).map((c) => c.id));
  const answeredCount = db.checkpointResponses.filter(
    (r) => r.userId === userId && checkpointIds.has(r.checkpointId),
  ).length;
  const assessment = db.assessments.find((a) => a.moduleId === moduleId);
  const attempts = db.attempts
    .filter((a) => a.userId === userId && a.assessmentId === assessment?.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const progress = db.progress.find((p) => p.userId === userId && p.moduleId === moduleId) ?? emptyProgress(userId, moduleId);

  const hasAssessment = !!assessment && assessment.questions.length > 0;
  const status = deriveStatus(progress, hasAssessment, attempts);
  const remaining = assessment ? attemptsRemaining(assessment, attempts.length) : null;

  return {
    module: mod,
    assignedAt,
    status,
    progress,
    videoDurationSec: video?.durationSec ?? 0,
    checkpointCount: checkpointIds.size,
    answeredCount,
    hasAssessment,
    questionCount: assessment?.questions.length ?? 0,
    passPercent: assessment?.passPercent ?? null,
    attempts: attempts.map(summary),
    attemptsRemaining: remaining,
    bestScorePercent: attempts.length ? Math.max(...attempts.map((a) => a.scorePercent)) : null,
    nextStep: nextStep({ status, videoCompleted: progress.videoCompleted, hasAssessment, attemptsRemaining: remaining }),
  };
}

export async function listMyTraining() {
  const s = requireLearner();
  const db = getDb();
  const items = db.assignments
    .filter((a) => a.userId === s.userId)
    .map((a) => buildItem(db, s.userId, a.moduleId, a.assignedAt))
    .filter((x): x is MyTrainingItem => x !== null)
    // Most recently assigned first.
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  return delay(clone(items));
}

export async function getMyTraining(moduleId: ID) {
  const s = requireLearner();
  assertAssigned(s, moduleId);
  const db = getDb();
  const assignment = db.assignments.find((a) => a.userId === s.userId && a.moduleId === moduleId)!;
  const item = buildItem(db, s.userId, moduleId, assignment.assignedAt);
  if (!item) notFound("Module");
  const video = db.videos.find((v) => v.moduleId === moduleId);
  const decisions = db.checkpoints
    .filter((c) => c.videoId === video?.id)
    .sort((a, b) => a.timestampSec - b.timestampSec)
    .map((checkpoint) => ({
      checkpoint,
      response: db.checkpointResponses.find((r) => r.userId === s.userId && r.checkpointId === checkpoint.id),
    }));
  const detail: MyTrainingDetail = { ...item, decisions };
  return delay(clone(detail));
}

/** Gatekeeping shared by "open the check" and "submit the check". */
function eligibleAssessment(s: Session, moduleId: ID): { assessment: KnowledgeAssessment; used: number } {
  assertAssigned(s, moduleId);
  const db = getDb();
  const assessment = db.assessments.find((a) => a.moduleId === moduleId);
  if (!assessment || !assessment.questions.length) notFound("Knowledge check");
  const progress = db.progress.find((p) => p.userId === s.userId && p.moduleId === moduleId);
  if (!progress?.videoCompleted) {
    throw new ServiceError("VALIDATION", "Watch the whole scenario before taking the knowledge check.");
  }
  const attempts = db.attempts.filter((a) => a.userId === s.userId && a.assessmentId === assessment.id);
  if (attempts.some((a) => a.passed)) {
    throw new ServiceError("VALIDATION", "You've already passed this knowledge check.");
  }
  if (attemptsRemaining(assessment, attempts.length) === 0) {
    throw new ServiceError("VALIDATION", "You've used all your attempts. Contact your facility administrator.");
  }
  return { assessment, used: attempts.length };
}

export async function getMyAssessment(moduleId: ID) {
  const s = requireLearner();
  const { assessment, used } = eligibleAssessment(s, moduleId);
  // Strip the answer key and explanations — the browser must never receive them before scoring.
  const view: LearnerAssessment = {
    id: assessment.id,
    moduleId,
    passPercent: assessment.passPercent,
    attemptsUsed: used,
    attemptsRemaining: attemptsRemaining(assessment, used),
    questions: assessment.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
    })),
  };
  return delay(clone(view));
}

export async function submitAssessment(moduleId: ID, answers: Record<ID, ID>) {
  const s = requireLearner();
  simulateNetwork();
  const { assessment, used } = eligibleAssessment(s, moduleId);
  const unanswered = assessment.questions.filter((q) => !answers[q.id]);
  if (unanswered.length) {
    throw new ServiceError("VALIDATION", `Answer every question before submitting (${unanswered.length} left).`);
  }

  // Scored on the "server" — the client only sends which options were chosen.
  const score = scoreAttempt(assessment, answers);
  const now = new Date().toISOString();
  const attempt = {
    id: newId("att"),
    userId: s.userId,
    assessmentId: assessment.id,
    answers: { ...answers },
    scorePercent: score.scorePercent,
    passed: score.passed,
    submittedAt: now,
  };

  updateDb((d) => {
    d.attempts.push(attempt);
    const user = d.users.find((u) => u.id === s.userId);
    const mod = d.modules.find((m) => m.id === moduleId);
    d.activity.push({
      id: newId("act"),
      type: "ASSESSMENT_SUBMITTED",
      actorId: s.userId,
      facilityId: s.facilityId,
      message: `${user?.name} scored ${score.scorePercent}% on ${mod?.title}`,
      createdAt: now,
    });
    if (score.passed) {
      const p = d.progress.find((x) => x.userId === s.userId && x.moduleId === moduleId)!;
      p.status = "COMPLETED";
      p.completedAt = now;
      p.updatedAt = now;
      d.activity.push({
        id: newId("act"),
        type: "MODULE_COMPLETED",
        actorId: s.userId,
        facilityId: s.facilityId,
        message: `${user?.name} completed ${mod?.title}`,
        createdAt: now,
      });
    }
  });

  const remaining = attemptsRemaining(assessment, used + 1);
  // Reveal the answer key only once it can't help a retry (passed, or no attempts left).
  const reveal = score.passed || remaining === 0;
  const result: AssessmentResult = {
    attempt: summary(attempt),
    correctCount: score.correctCount,
    total: score.total,
    passPercent: assessment.passPercent,
    attemptsRemaining: score.passed ? null : remaining,
    answersRevealed: reveal,
    review: assessment.questions.map((q) => {
      const chosen = q.options.find((o) => o.id === answers[q.id]);
      return {
        questionId: q.id,
        text: q.text,
        chosenLabel: chosen?.label ?? null,
        correct: score.correctness[q.id],
        ...(reveal ? { correctLabel: q.options.find((o) => o.isCorrect)?.label, feedback: q.feedback } : {}),
      };
    }),
  };
  return delay(clone(result));
}

export async function listMyActivity(limit = 8) {
  const s = requireLearner();
  const rows = getDb()
    .activity.filter((a) => a.actorId === s.userId)
    // Newest first; reversing before the (stable) sort puts later-recorded events first on ties.
    .reverse()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  return delay(clone(rows));
}
