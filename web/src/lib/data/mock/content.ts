import {
  assessmentProblems,
  checkpointProblems,
  isSafeMediaUrl,
  moduleDetailProblems,
  publishProblems,
  type AssessmentDraft,
  type CheckpointDraft,
} from "@/lib/content";
import type { DecisionCheckpoint, ID, KnowledgeAssessment, ModuleStatus, ScenarioVideo, TrainingModule } from "@/lib/types";
import { ServiceError, type ModuleDetailsInput, type ModuleEditBundle, type ModuleRow, type VideoInput } from "../service";
import { clone, delay, newId, notFound, simulateNetwork } from "./helpers";
import { log, requireSuperAdmin } from "./platform";
import type { MockDb } from "./seed";
import { getDb, updateDb } from "./store";

/**
 * Mock content-management endpoints (F5, D12: Super Admin only).
 *
 * Content is data, not code (scope doc §6.4): modules, timestamps, questions and
 * rationales all live here and can change without a deploy.
 *
 * Referential integrity: once a learner has answered a decision point or question,
 * that item (and the option they chose) can't be deleted — their record points at it.
 */

const isNew = (id: string) => id.startsWith("new-");

function fail(problems: string[]): never {
  throw new ServiceError("VALIDATION", problems.slice(0, 3).join(" "));
}

function getModule(db: MockDb, id: ID) {
  const m = db.modules.find((x) => x.id === id);
  if (!m) notFound("Module");
  return m;
}

/** Which checkpoint/option/question ids learners have already used. */
function usage(db: MockDb, moduleId: ID) {
  const video = db.videos.find((v) => v.moduleId === moduleId);
  const cpIds = new Set(db.checkpoints.filter((c) => c.videoId === video?.id).map((c) => c.id));
  const responses = db.checkpointResponses.filter((r) => cpIds.has(r.checkpointId));
  const assessment = db.assessments.find((a) => a.moduleId === moduleId);
  const attempts = db.attempts.filter((a) => a.assessmentId === assessment?.id);
  return {
    answeredCheckpointIds: new Set(responses.map((r) => r.checkpointId)),
    answeredOptionIds: new Set([...responses.map((r) => r.optionId), ...attempts.flatMap((a) => Object.values(a.answers))]),
    answeredQuestionIds: new Set(attempts.flatMap((a) => Object.keys(a.answers))),
  };
}

function bundle(db: MockDb, id: ID): ModuleEditBundle {
  const mod = getModule(db, id);
  const video = db.videos.find((v) => v.moduleId === id);
  const checkpoints = db.checkpoints.filter((c) => c.videoId === video?.id).sort((a, b) => a.timestampSec - b.timestampSec);
  const assessment = db.assessments.find((a) => a.moduleId === id);
  const u = usage(db, id);
  return {
    module: mod,
    video,
    checkpoints,
    assessment,
    assignedCount: db.assignments.filter((a) => a.moduleId === id).length,
    answeredCheckpointIds: [...u.answeredCheckpointIds],
    answeredOptionIds: [...u.answeredOptionIds],
    answeredQuestionIds: [...u.answeredQuestionIds],
    publishProblems: publishProblems({ module: mod, video, checkpoints, assessment }),
  };
}

function cleanDetails(input: ModuleDetailsInput): ModuleDetailsInput {
  const clean = {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    learningObjectives: input.learningObjectives.map((o) => o.trim()).filter(Boolean),
    thumbnailUrl: input.thumbnailUrl.trim() || "/thumbnails/mod-intake.svg",
    estimatedMinutes: Math.round(Number(input.estimatedMinutes)),
  };
  const problems = moduleDetailProblems(clean);
  if (!isSafeMediaUrl(clean.thumbnailUrl)) problems.push("Thumbnail must be an https:// link or a site path.");
  if (problems.length) fail(problems);
  return clean;
}

function touch(d: MockDb, id: ID) {
  d.modules.find((m) => m.id === id)!.updatedAt = new Date().toISOString();
}

// ── Reads ─────────────────────────────────────────────────

export async function listModuleRows() {
  requireSuperAdmin();
  const db = getDb();
  const rows: ModuleRow[] = db.modules.map((m) => {
    const video = db.videos.find((v) => v.moduleId === m.id);
    const assigned = db.assignments.filter((a) => a.moduleId === m.id);
    return {
      module: m,
      hasVideo: !!video?.sourceUrl,
      checkpointCount: db.checkpoints.filter((c) => c.videoId === video?.id).length,
      questionCount: db.assessments.find((a) => a.moduleId === m.id)?.questions.length ?? 0,
      assignedCount: assigned.length,
      completedCount: db.progress.filter((p) => p.moduleId === m.id && p.status === "COMPLETED").length,
    };
  });
  return delay(clone(rows.sort((a, b) => b.module.updatedAt.localeCompare(a.module.updatedAt))));
}

export async function getModuleForEdit(id: ID) {
  requireSuperAdmin();
  return delay(clone(bundle(getDb(), id)));
}

// ── Writes ────────────────────────────────────────────────

export async function createModule(input: ModuleDetailsInput) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const clean = cleanDetails(input);
  const now = new Date().toISOString();
  const mod: TrainingModule = { id: newId("mod"), ...clean, status: "DRAFT", isPlaceholder: false, createdAt: now, updatedAt: now };
  updateDb((d) => {
    d.modules.push(mod);
    log(d, s, "CONTENT_UPDATED", null, `Module "${mod.title}" created as a draft`);
  });
  return delay(clone(mod));
}

export async function updateModuleDetails(id: ID, input: ModuleDetailsInput) {
  const s = requireSuperAdmin();
  simulateNetwork();
  getModule(getDb(), id);
  const clean = cleanDetails(input);
  updateDb((d) => {
    Object.assign(d.modules.find((m) => m.id === id)!, clean);
    touch(d, id);
    log(d, s, "CONTENT_UPDATED", null, `Module "${clean.title}" details updated`);
  });
  return delay(clone(getDb().modules.find((m) => m.id === id)!));
}

export async function saveModuleVideo(id: ID, input: VideoInput) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const db = getDb();
  const mod = getModule(db, id);
  const sourceUrl = input.sourceUrl.trim();
  const posterUrl = input.posterUrl?.trim() || undefined;
  const captionsUrl = input.captionsUrl?.trim() || undefined;
  const durationSec = Math.round(Number(input.durationSec) * 10) / 10;
  const problems: string[] = [];
  if (!isSafeMediaUrl(sourceUrl)) problems.push("Video link must be an https:// URL (HLS .m3u8 or MP4).");
  if (posterUrl && !isSafeMediaUrl(posterUrl)) problems.push("Poster image must be an https:// link or a site path.");
  if (captionsUrl && !isSafeMediaUrl(captionsUrl)) problems.push("Captions file must be an https:// link or a site path.");
  if (!(durationSec > 0)) problems.push("Load the video preview so its length is known.");
  const existing = db.videos.find((v) => v.moduleId === id);
  const late = db.checkpoints.filter((c) => c.videoId === existing?.id && c.timestampSec >= durationSec);
  if (late.length) problems.push(`${late.length} decision point(s) are after the end of this video — move them first.`);
  if (problems.length) fail(problems);

  let saved!: ScenarioVideo;
  updateDb((d) => {
    const v = d.videos.find((x) => x.moduleId === id);
    if (v) Object.assign(v, { sourceUrl, posterUrl, captionsUrl, durationSec });
    else d.videos.push({ id: newId("vid"), moduleId: id, sourceUrl, posterUrl, captionsUrl, durationSec });
    saved = d.videos.find((x) => x.moduleId === id)!;
    touch(d, id);
    log(d, s, "CONTENT_UPDATED", null, `Video for "${mod.title}" updated`);
  });
  return delay(clone(saved));
}

export async function saveCheckpoints(id: ID, drafts: CheckpointDraft[]) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const db = getDb();
  const mod = getModule(db, id);
  const video = db.videos.find((v) => v.moduleId === id);
  if (!video) throw new ServiceError("VALIDATION", "Add the scenario video before adding decision points.");
  const problems = checkpointProblems(drafts, video.durationSec);
  if (problems.length) fail(problems);

  // Don't orphan learner answers.
  const used = usage(db, id);
  const existing = db.checkpoints.filter((c) => c.videoId === video.id);
  const keptIds = new Set(drafts.map((c) => c.id));
  if (existing.some((c) => !keptIds.has(c.id) && used.answeredCheckpointIds.has(c.id))) {
    throw new ServiceError("VALIDATION", "A decision point you removed has already been answered by learners, so it can't be deleted.");
  }
  const keptOptions = new Set(drafts.flatMap((c) => c.options.map((o) => o.id)));
  if (existing.some((c) => keptIds.has(c.id) && c.options.some((o) => !keptOptions.has(o.id) && used.answeredOptionIds.has(o.id)))) {
    throw new ServiceError("VALIDATION", "An answer option you removed has already been chosen by learners, so it can't be deleted.");
  }

  const saved: DecisionCheckpoint[] = [...drafts]
    .sort((a, b) => a.timestampSec - b.timestampSec)
    .map((c, i) => {
      const cpId = isNew(c.id) ? newId("cp") : c.id;
      return {
        id: cpId,
        videoId: video.id,
        timestampSec: Math.round(c.timestampSec * 10) / 10,
        prompt: c.prompt.trim(),
        generalRationale: c.generalRationale?.trim() || undefined,
        sortOrder: i + 1,
        options: c.options.map((o) => ({
          id: isNew(o.id) ? newId(`${cpId}-opt`) : o.id,
          label: o.label.trim(),
          rationale: o.rationale?.trim() || undefined,
        })),
      };
    });

  updateDb((d) => {
    d.checkpoints = [...d.checkpoints.filter((c) => c.videoId !== video.id), ...saved];
    touch(d, id);
    log(d, s, "CONTENT_UPDATED", null, `Decision points for "${mod.title}" updated (${saved.length})`);
  });
  return delay(clone(saved));
}

export async function saveAssessment(id: ID, draft: AssessmentDraft) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const db = getDb();
  const mod = getModule(db, id);
  const problems = assessmentProblems(draft);
  if (problems.length) fail(problems);

  const existing = db.assessments.find((a) => a.moduleId === id);
  const used = usage(db, id);
  const keptQ = new Set(draft.questions.map((q) => q.id));
  if (existing?.questions.some((q) => !keptQ.has(q.id) && used.answeredQuestionIds.has(q.id))) {
    throw new ServiceError("VALIDATION", "A question you removed has already been answered by learners, so it can't be deleted.");
  }
  const keptO = new Set(draft.questions.flatMap((q) => q.options.map((o) => o.id)));
  if (existing?.questions.some((q) => q.options.some((o) => !keptO.has(o.id) && used.answeredOptionIds.has(o.id)))) {
    throw new ServiceError("VALIDATION", "An answer you removed has already been chosen by learners, so it can't be deleted.");
  }

  const assessment: KnowledgeAssessment = {
    id: existing?.id ?? newId("asm"),
    moduleId: id,
    passPercent: draft.passPercent,
    maxAttempts: draft.maxAttempts,
    questions: draft.questions.map((q) => {
      const qId = isNew(q.id) ? newId("q") : q.id;
      return {
        id: qId,
        text: q.text.trim(),
        feedback: q.feedback?.trim() || undefined,
        options: q.options.map((o) => ({ id: isNew(o.id) ? newId(`${qId}-opt`) : o.id, label: o.label.trim(), isCorrect: o.isCorrect })),
      };
    }),
  };
  updateDb((d) => {
    d.assessments = [...d.assessments.filter((a) => a.moduleId !== id), assessment];
    touch(d, id);
    log(d, s, "CONTENT_UPDATED", null, `Knowledge check for "${mod.title}" updated (${assessment.questions.length} question${assessment.questions.length === 1 ? "" : "s"})`);
  });
  return delay(clone(assessment));
}

export async function setModuleStatus(id: ID, status: ModuleStatus) {
  const s = requireSuperAdmin();
  simulateNetwork();
  const db = getDb();
  const b = bundle(db, id);
  if (status === "ACTIVE" && b.publishProblems.length) fail(["This module isn't ready to publish:", ...b.publishProblems]);
  if (status === "DRAFT" && b.assignedCount > 0) {
    throw new ServiceError("VALIDATION", "This module is already assigned to learners. Disable it instead of moving it back to draft.");
  }
  const label = { ACTIVE: "published", DRAFT: "moved to draft", DISABLED: "disabled" }[status];
  updateDb((d) => {
    d.modules.find((m) => m.id === id)!.status = status;
    touch(d, id);
    log(d, s, "MODULE_STATUS_CHANGED", null, `Module "${b.module.title}" ${label}`);
  });
  return delay(clone(getDb().modules.find((m) => m.id === id)!));
}
