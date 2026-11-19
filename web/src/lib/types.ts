/**
 * Domain types — the frontend's copy of the data model in scope document §8
 * (see docs/HLD_LLD_LEARNING.md §5.1). The real backend's API must return these shapes,
 * so the mock and the real service are interchangeable.
 *
 * Conventions: ids are strings, timestamps are ISO-8601 strings, video times are seconds.
 */

export type ID = string;
export type ISODate = string;

export type Role = "SUPER_ADMIN" | "FACILITY_ADMIN" | "LEARNER";

/** Tenant boundary: Facility Admins, learners and assignments belong to exactly one facility. */
export interface Facility {
  id: ID;
  name: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  isActive: boolean;
  createdAt: ISODate;
}

export type UserStatus = "INVITED" | "ACTIVE" | "DEACTIVATED";

export interface User {
  id: ID;
  role: Role;
  /** null only for SUPER_ADMIN, who belongs to no facility. */
  facilityId: ID | null;
  name: string;
  email: string;
  jobTitle?: string;
  status: UserStatus;
  createdAt: ISODate;
}

export type ModuleStatus = "DRAFT" | "ACTIVE" | "DISABLED";

export interface TrainingModule {
  id: ID;
  title: string;
  description: string;
  category: string;
  learningObjectives: string[];
  thumbnailUrl: string;
  estimatedMinutes: number;
  /** Only ACTIVE modules can be newly assigned. */
  status: ModuleStatus;
  /** Marks synthetic placeholder content that is not client-approved. */
  isPlaceholder: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ScenarioVideo {
  id: ID;
  moduleId: ID;
  /** HLS (.m3u8) or MP4 URL. The provider adapter decides how to play it. */
  sourceUrl: string;
  posterUrl?: string;
  captionsUrl?: string;
  durationSec: number;
}

export interface CheckpointOption {
  id: ID;
  label: string;
  /** Optional per-option feedback (decision D5). */
  rationale?: string;
}

/** A timestamp in the video where playback pauses for a decision. */
export interface DecisionCheckpoint {
  id: ID;
  videoId: ID;
  timestampSec: number;
  prompt: string;
  options: CheckpointOption[];
  /** General feedback shown after any answer (decision D5). */
  generalRationale?: string;
  sortOrder: number;
}

export interface CheckpointResponse {
  id: ID;
  userId: ID;
  checkpointId: ID;
  optionId: ID;
  answeredAt: ISODate;
}

export interface AnswerOption {
  id: ID;
  label: string;
  isCorrect: boolean;
}

export interface AssessmentQuestion {
  id: ID;
  text: string;
  options: AnswerOption[];
  /** Optional explanation shown on the results screen. */
  feedback?: string;
}

export interface KnowledgeAssessment {
  id: ID;
  moduleId: ID;
  /** Pass mark in percent (decision D6, default 80). */
  passPercent: number;
  /** null = unlimited retries (decision D6). */
  maxAttempts: number | null;
  questions: AssessmentQuestion[];
}

export interface AssessmentAttempt {
  id: ID;
  userId: ID;
  assessmentId: ID;
  /** questionId → chosen optionId */
  answers: Record<ID, ID>;
  scorePercent: number;
  passed: boolean;
  submittedAt: ISODate;
}

export type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface TrainingAssignment {
  id: ID;
  facilityId: ID;
  userId: ID;
  moduleId: ID;
  assignedById: ID;
  assignedAt: ISODate;
}

export interface LearnerProgress {
  userId: ID;
  moduleId: ID;
  status: ProgressStatus;
  /** Where to resume playback. */
  lastPositionSec: number;
  /** Furthest point reached; learners can't seek beyond it (decision D4). */
  furthestSec: number;
  videoCompleted: boolean;
  updatedAt: ISODate;
  completedAt?: ISODate;
}

/** Demo request from the public website (decision D9). Not in §8; added for lead capture. */
export interface Lead {
  id: ID;
  name: string;
  email: string;
  organization: string;
  role?: string;
  phone?: string;
  message?: string;
  createdAt: ISODate;
}

/** Basic platform activity for the Super Admin view. Not in §8; added for F5.8. */
export interface ActivityEvent {
  id: ID;
  type:
    | "FACILITY_CREATED"
    | "USER_CREATED"
    | "USER_DEACTIVATED"
    | "MODULE_ASSIGNED"
    | "MODULE_STARTED"
    | "MODULE_COMPLETED"
    | "ASSESSMENT_SUBMITTED";
  actorId: ID | null;
  facilityId: ID | null;
  message: string;
  createdAt: ISODate;
}

/** The signed-in user as the app sees them. Replaced by a real session/token later. */
export interface Session {
  userId: ID;
  role: Role;
  facilityId: ID | null;
  name: string;
  email: string;
}
