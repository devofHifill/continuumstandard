import type {
  Facility,
  ID,
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

  // ── Demo tooling ────────────────────────────────────────
  /** Restore the seed data and sign out. Mock only; the real API won't have this. */
  resetDemoData(): Promise<void>;
  /** Subscribe to data/session changes (for React's useSyncExternalStore). */
  subscribe(listener: () => void): () => void;
}

export type ServiceErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION";

export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
