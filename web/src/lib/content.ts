import type { AssessmentQuestion, DecisionCheckpoint, KnowledgeAssessment, ScenarioVideo, TrainingModule } from "@/lib/types";

/**
 * Content rules for the Super Admin editor (F5) — pure functions, unit-tested,
 * used by both the editor (instant feedback) and the mock backend (enforcement).
 */

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
/** Decision points must be at least this far apart, so one can't hide another (seconds). */
export const MIN_CHECKPOINT_GAP_SEC = 2;

export type CheckpointDraft = Pick<DecisionCheckpoint, "id" | "timestampSec" | "prompt" | "options" | "generalRationale">;
export type QuestionDraft = Pick<AssessmentQuestion, "id" | "text" | "options" | "feedback">;
export interface AssessmentDraft {
  passPercent: number;
  maxAttempts: number | null;
  questions: QuestionDraft[];
}

/** Problems with a set of decision points, as human-readable messages. Empty = valid. */
export function checkpointProblems(checkpoints: CheckpointDraft[], durationSec: number | null): string[] {
  const problems: string[] = [];
  const sorted = [...checkpoints].sort((a, b) => a.timestampSec - b.timestampSec);
  sorted.forEach((c, i) => {
    const n = `Decision point ${i + 1}`;
    if (!Number.isFinite(c.timestampSec) || c.timestampSec <= 0) problems.push(`${n}: set a time after the start of the video.`);
    if (durationSec && c.timestampSec >= durationSec) problems.push(`${n}: the time is past the end of the video.`);
    if (i > 0 && c.timestampSec - sorted[i - 1].timestampSec < MIN_CHECKPOINT_GAP_SEC) {
      problems.push(`${n}: too close to the previous decision point (keep them ${MIN_CHECKPOINT_GAP_SEC}+ seconds apart).`);
    }
    if (!c.prompt.trim()) problems.push(`${n}: write the question.`);
    const filled = c.options.filter((o) => o.label.trim());
    if (filled.length < MIN_OPTIONS) problems.push(`${n}: add at least ${MIN_OPTIONS} answer options.`);
    if (c.options.length > MAX_OPTIONS) problems.push(`${n}: use at most ${MAX_OPTIONS} answer options.`);
    if (c.options.some((o) => !o.label.trim())) problems.push(`${n}: remove or fill in empty answer options.`);
    if (!c.generalRationale?.trim() && c.options.some((o) => !o.rationale?.trim())) {
      problems.push(`${n}: add feedback — a general rationale, or one for every option (D5).`);
    }
  });
  return problems;
}

export function assessmentProblems(a: AssessmentDraft): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(a.passPercent) || a.passPercent < 1 || a.passPercent > 100) {
    problems.push("Pass mark must be a whole number from 1 to 100.");
  }
  if (a.maxAttempts !== null && (!Number.isInteger(a.maxAttempts) || a.maxAttempts < 1)) {
    problems.push("Attempts must be at least 1 (or unlimited).");
  }
  a.questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!q.text.trim()) problems.push(`${n}: write the question.`);
    if (q.options.length < MIN_OPTIONS) problems.push(`${n}: add at least ${MIN_OPTIONS} answer options.`);
    if (q.options.length > MAX_OPTIONS) problems.push(`${n}: use at most ${MAX_OPTIONS} answer options.`);
    if (q.options.some((o) => !o.label.trim())) problems.push(`${n}: remove or fill in empty answer options.`);
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) problems.push(`${n}: mark exactly one correct answer.`);
  });
  return problems;
}

export function moduleDetailProblems(m: Pick<TrainingModule, "title" | "description" | "category" | "estimatedMinutes">): string[] {
  const problems: string[] = [];
  if (!m.title.trim()) problems.push("Add a title.");
  if (m.title.length > 120) problems.push("Keep the title under 120 characters.");
  if (!m.category.trim()) problems.push("Add a category.");
  if (!m.description.trim()) problems.push("Add a short description.");
  if (!Number.isInteger(m.estimatedMinutes) || m.estimatedMinutes < 1 || m.estimatedMinutes > 600) {
    problems.push("Estimated time must be between 1 and 600 minutes.");
  }
  return problems;
}

/**
 * What stops a module from being published (set ACTIVE). Draft content can be
 * saved incomplete; publishing requires everything a learner needs (scope doc §6.4).
 */
export function publishProblems(input: {
  module: Pick<TrainingModule, "title" | "description" | "category" | "estimatedMinutes">;
  video: Pick<ScenarioVideo, "sourceUrl" | "durationSec"> | undefined;
  checkpoints: CheckpointDraft[];
  assessment: Pick<KnowledgeAssessment, "passPercent" | "maxAttempts" | "questions"> | undefined;
}): string[] {
  const problems = [...moduleDetailProblems(input.module)];
  if (!input.video?.sourceUrl.trim()) problems.push("Add the scenario video.");
  else if (!input.video.durationSec) problems.push("Load the video once so its length is known.");
  if (input.checkpoints.length === 0) problems.push("Add at least one decision point.");
  problems.push(...checkpointProblems(input.checkpoints, input.video?.durationSec ?? null));
  if (!input.assessment || input.assessment.questions.length === 0) problems.push("Add at least one knowledge-check question.");
  else problems.push(...assessmentProblems(input.assessment));
  return problems;
}

/** Accept http(s) URLs and same-site paths only — no `javascript:` or `data:` URLs. */
export function isSafeMediaUrl(url: string) {
  const u = url.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
