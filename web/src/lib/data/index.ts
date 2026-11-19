import { MockDataService } from "./mock/mockService";
import type { DataService } from "./service";

/**
 * The one place that decides which backend the app talks to.
 * Swap to `new ApiDataService()` when the real API exists — nothing else changes.
 */
export const data: DataService = new MockDataService();

export {
  ServiceError,
  type AdminInput,
  type AdminRow,
  type AssessmentResult,
  type AssignmentRow,
  type AssignResult,
  type AttemptSummary,
  type AttentionItem,
  type AuthTokenPurpose,
  type CheckpointResult,
  type DataService,
  type FacilityInput,
  type FacilityLearnerRow,
  type FacilityRow,
  type FacilitySummary,
  type LearnerInput,
  type LearnerReport,
  type LearnerAssessment,
  type ModuleDetailsInput,
  type ModuleEditBundle,
  type ModuleRow,
  type MyTrainingDetail,
  type MyTrainingItem,
  type PlatformSummary,
  type PlaybackBundle,
  type ProgressUpdate,
  type VideoInput,
} from "./service";
