import { MockDataService } from "./mock/mockService";
import type { DataService } from "./service";

/**
 * The one place that decides which backend the app talks to.
 * Swap to `new ApiDataService()` when the real API exists — nothing else changes.
 */
export const data: DataService = new MockDataService();

export {
  ServiceError,
  type AuthTokenPurpose,
  type CheckpointResult,
  type DataService,
  type PlaybackBundle,
  type ProgressUpdate,
} from "./service";
