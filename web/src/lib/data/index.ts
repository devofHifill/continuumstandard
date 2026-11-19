import { MockDataService } from "./mock/mockService";
import type { DataService } from "./service";

/**
 * The one place that decides which backend the app talks to.
 * Swap to `new ApiDataService()` when the real API exists — nothing else changes.
 */
export const data: DataService = new MockDataService();

export {
  ServiceError,
  type AssessmentResult,
  type AssignmentRow,
  type AssignResult,
  type AttemptSummary,
  type AttentionItem,
  type AuthTokenPurpose,
  type CheckpointResult,
  type DataService,
  type FacilityLearnerRow,
  type FacilitySummary,
  type LearnerInput,
  type LearnerReport,
  type LearnerAssessment,
  type MyTrainingDetail,
  type MyTrainingItem,
  type PlaybackBundle,
  type ProgressUpdate,
} from "./service";
