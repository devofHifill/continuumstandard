import type {
  CheckpointOption,
  CheckpointResponse,
  DecisionCheckpoint,
  Facility,
  ID,
  ScenarioVideo,
  LearnerProgress,
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

  // ── Demo tooling ────────────────────────────────────────
  /** Restore the seed data and sign out. Mock only; the real API won't have this. */
  resetDemoData(): Promise<void>;
  /** Subscribe to data/session changes (for React's useSyncExternalStore). */
  subscribe(listener: () => void): () => void;
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
