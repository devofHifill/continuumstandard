import type { NextStep } from "@/lib/learning";
import type {
  ActivityEvent,
  CheckpointOption,
  CheckpointResponse,
  DecisionCheckpoint,
  Facility,
  ID,
  ScenarioVideo,
  LearnerProgress,
  ProgressStatus,
  Session,
  TrainingAssignment,
  TrainingModule,
  User,
} from "@/lib/types";

/**
 * The contract between the UI and "the backend".
 *
 * Today it's implemented by MockDataService (seed data + localStorage).
 * Later an ApiDataService will implement the same interface with HTTP calls,
 * and no page or component has to change. (Adapter / Repository pattern —
 * see docs/HLD_LLD_LEARNING.md §5.6.)
 *
 * Every method that touches facility data takes the caller's identity from the
 * current session — never from a parameter — and applies the same role and
 * facility rules the real API must enforce.
 *
 * Grows phase by phase; F0 covers auth and read access.
 */
export interface DataService {
  // ── Auth ────────────────────────────────────────────────
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  /** Current session, or null when signed out. Synchronous so the UI can read it on render. */
  getSession(): Session | null;
  /**
   * Re-check the session with "the server": signs out and throws UNAUTHENTICATED if the
   * account was deactivated or the facility switched off since login (F2.7).
   */
  refreshSession(): Promise<Session | null>;
  /** Email a reset link. Always resolves the same way, whether or not the email exists. */
  requestPasswordReset(email: string): Promise<void>;
  /** Check an invite/reset link before showing the form. Throws VALIDATION if used, expired or unknown. */
  checkAuthToken(token: string, purpose: AuthTokenPurpose): Promise<{ name: string; email: string }>;
  /** Set a password from an invite/reset link, then sign in. */
  completeAuthToken(token: string, purpose: AuthTokenPurpose, newPassword: string): Promise<Session>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Learners and admins may edit their own name and job title; email is managed by admins. */
  updateMyProfile(update: { name: string; jobTitle?: string }): Promise<User>;

  // ── Facilities ──────────────────────────────────────────
  /** Super Admin: all facilities. Facility Admin / Learner: only their own. */
  listFacilities(): Promise<Facility[]>;
  getFacility(id: ID): Promise<Facility>;

  // ── Users ───────────────────────────────────────────────
  /** Super Admin: everyone. Facility Admin: users in own facility. Learner: forbidden. */
  listUsers(filter?: { role?: User["role"]; facilityId?: ID }): Promise<User[]>;
  getUser(id: ID): Promise<User>;

  // ── Training content ────────────────────────────────────
  /** Super Admin sees all statuses; everyone else sees ACTIVE modules only. */
  listModules(): Promise<TrainingModule[]>;

  // ── Assignments & progress ──────────────────────────────
  /** Scoped like listUsers; a Learner gets only their own assignments. */
  listAssignments(filter?: { userId?: ID; moduleId?: ID }): Promise<TrainingAssignment[]>;
  listProgress(filter?: { userId?: ID; moduleId?: ID }): Promise<LearnerProgress[]>;

  // ── Scenario player (F1) ────────────────────────────────
  /**
   * Everything the player needs to start or resume a module for the signed-in learner.
   * Allowed only when the learner is assigned to the module.
   */
  getPlayback(moduleId: ID): Promise<PlaybackBundle>;
  /**
   * Save the learner's answer at a decision point and return the approved feedback.
   * Idempotent per (learner, checkpoint): if already answered, the first answer is kept and returned.
   */
  submitCheckpointResponse(checkpointId: ID, optionId: ID): Promise<CheckpointResult>;
  /** Save playback position. `furthestSec` only ever increases on the server side. */
  saveProgress(moduleId: ID, update: ProgressUpdate): Promise<LearnerProgress>;

  // ── Learner (F3) ────────────────────────────────────────
  /**
   * The signed-in learner's assigned training, one row per module with everything a
   * card needs (status, progress, attempts, next step) — one request instead of many.
   */
  listMyTraining(): Promise<MyTrainingItem[]>;
  /** One assigned module, plus the learner's decision-point answers (for review). */
  getMyTraining(moduleId: ID): Promise<MyTrainingDetail>;
  /**
   * The knowledge check for an assigned module, WITHOUT the answer key.
   * Only available once the scenario video is watched, not yet passed, and attempts remain.
   */
  getMyAssessment(moduleId: ID): Promise<LearnerAssessment>;
  /** Score on the server; completes the module on a pass. Correct answers are revealed only once passed. */
  submitAssessment(moduleId: ID, answers: Record<ID, ID>): Promise<AssessmentResult>;
  /** The learner's own recent activity, newest first. */
  listMyActivity(limit?: number): Promise<ActivityEvent[]>;

  // ── Facility administration (F4) ────────────────────────
  // Facility Admins always act on their own facility (any `facilityId` they pass must match).
  // A Super Admin must name the facility — so F5 can reuse these for platform admin.
  getFacilitySummary(facilityId?: ID): Promise<FacilitySummary>;
  listFacilityLearners(facilityId?: ID): Promise<FacilityLearnerRow[]>;
  /** Create an INVITED learner and email them a set-password link (decision D8). */
  createLearner(input: LearnerInput, facilityId?: ID): Promise<User>;
  updateLearner(userId: ID, input: LearnerInput): Promise<User>;
  /** Deactivate (history kept, sign-in blocked) or reactivate a learner. */
  setLearnerActive(userId: ID, active: boolean): Promise<User>;
  /** New invite link for a learner who hasn't set a password yet; the old link stops working. */
  resendInvite(userId: ID): Promise<void>;
  /** Assign every chosen ACTIVE module to every chosen learner (D3). Existing assignments are skipped. */
  assignTraining(userIds: ID[], moduleIds: ID[]): Promise<AssignResult>;
  listFacilityAssignments(facilityId?: ID): Promise<AssignmentRow[]>;
  /** One learner's full training record: every assignment with progress, decisions and attempts. */
  getLearnerReport(userId: ID): Promise<LearnerReport>;

  // ── Demo tooling ────────────────────────────────────────
  /** Restore the seed data and sign out. Mock only; the real API won't have this. */
  resetDemoData(): Promise<void>;
  /** Subscribe to data/session changes (for React's useSyncExternalStore). */
  subscribe(listener: () => void): () => void;
}

export interface AttemptSummary {
  id: ID;
  scorePercent: number;
  passed: boolean;
  submittedAt: string;
}

export interface MyTrainingItem {
  module: TrainingModule;
  assignedAt: string;
  status: ProgressStatus;
  progress: LearnerProgress;
  videoDurationSec: number;
  checkpointCount: number;
  answeredCount: number;
  hasAssessment: boolean;
  questionCount: number;
  passPercent: number | null;
  /** Newest first. */
  attempts: AttemptSummary[];
  attemptsRemaining: number | null;
  bestScorePercent: number | null;
  nextStep: NextStep;
}

export interface MyTrainingDetail extends MyTrainingItem {
  decisions: { checkpoint: DecisionCheckpoint; response?: CheckpointResponse }[];
}

/** A knowledge check as the learner receives it: no `isCorrect`, no feedback. */
export interface LearnerAssessment {
  id: ID;
  moduleId: ID;
  passPercent: number;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  questions: { id: ID; text: string; options: { id: ID; label: string }[] }[];
}

export interface AssessmentResult {
  attempt: AttemptSummary;
  correctCount: number;
  total: number;
  passPercent: number;
  attemptsRemaining: number | null;
  /** Whether correct answers and explanations are included (only after a pass). */
  answersRevealed: boolean;
  review: {
    questionId: ID;
    text: string;
    chosenLabel: string | null;
    correct: boolean;
    correctLabel?: string;
    feedback?: string;
  }[];
}

export interface LearnerInput {
  name: string;
  email: string;
  jobTitle?: string;
}

export interface FacilityLearnerRow {
  user: User;
  assigned: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  lastActivityAt: string | null;
}

export interface AttentionItem {
  kind: "INVITE_PENDING" | "LOCKED_OUT" | "FAILED_CHECK";
  userId: ID;
  userName: string;
  moduleTitle?: string;
  detail: string;
}

export interface FacilitySummary {
  facility: Facility;
  learners: { active: number; invited: number; deactivated: number };
  assignments: { total: number; notStarted: number; inProgress: number; completed: number };
  /** Completed ÷ total assignments, 0–100. */
  completionPercent: number;
  /** Average best score across learners who have taken a check, or null. */
  averageScore: number | null;
  attention: AttentionItem[];
  recentActivity: ActivityEvent[];
}

export interface AssignmentRow {
  assignmentId: ID;
  learner: Pick<User, "id" | "name" | "email" | "status" | "jobTitle">;
  module: Pick<TrainingModule, "id" | "title" | "category">;
  assignedAt: string;
  assignedByName: string;
  status: ProgressStatus;
  answeredCount: number;
  checkpointCount: number;
  bestScorePercent: number | null;
  attemptsCount: number;
  passPercent: number | null;
  lockedOut: boolean;
  completedAt?: string;
}

export interface AssignResult {
  created: number;
  /** Learner/module pairs that were already assigned. */
  skipped: number;
}

export interface LearnerReport {
  learner: User;
  items: MyTrainingDetail[];
}

/** INVITE = first password for a new account; RESET = forgotten password. */
export type AuthTokenPurpose = "INVITE" | "RESET";

export interface PlaybackBundle {
  module: TrainingModule;
  video: ScenarioVideo;
  /** Sorted by timestamp. */
  checkpoints: DecisionCheckpoint[];
  /** The learner's existing answers for this module's checkpoints. */
  responses: CheckpointResponse[];
  progress: LearnerProgress;
}

export interface CheckpointResult {
  response: CheckpointResponse;
  /** The option the learner chose (with its optional rationale). */
  option: CheckpointOption;
  generalRationale?: string;
  /** true if this checkpoint had already been answered (first answer kept). */
  alreadyAnswered: boolean;
}

export interface ProgressUpdate {
  positionSec: number;
  furthestSec: number;
  videoCompleted?: boolean;
}

export type ServiceErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "NETWORK";

export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
