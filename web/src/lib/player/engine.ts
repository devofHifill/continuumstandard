import type { CheckpointResult } from "@/lib/data";
import type { DecisionCheckpoint, ID } from "@/lib/types";

/**
 * Scenario player engine — pure logic, no React, no <video>.
 *
 * Kept separate from the UI so the rules (when to pause, how far a learner may seek,
 * which transitions are legal) can be unit-tested and explained on their own.
 * See docs/HLD_LLD_LEARNING.md §5.4 for the state diagram.
 */

/** Pause this close to a checkpoint counts as "reached" (seconds). */
export const CHECKPOINT_EPSILON = 0.05;

export type Phase =
  | "ready" // loaded, not playing yet
  | "playing"
  | "paused" // paused by the learner
  | "checkpoint" // paused by the engine; question showing
  | "submitting" // answer being saved
  | "feedback" // rationale showing; waiting for Continue
  | "ended"; // video finished

export interface PlayerState {
  phase: Phase;
  activeCheckpointId: ID | null;
  selectedOptionId: ID | null;
  /** checkpointId → chosen optionId */
  answered: Record<ID, ID>;
  feedback: CheckpointResult | null;
  error: string | null;
}

export type PlayerEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "REACHED_CHECKPOINT"; checkpointId: ID }
  | { type: "SELECT"; optionId: ID }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_OK"; result: CheckpointResult }
  | { type: "SUBMIT_FAIL"; message: string }
  | { type: "CONTINUE" }
  | { type: "ENDED" };

export function initialState(answered: Record<ID, ID> = {}): PlayerState {
  return { phase: "ready", activeCheckpointId: null, selectedOptionId: null, answered, feedback: null, error: null };
}

/**
 * The state machine. Any event that isn't legal in the current phase is ignored —
 * e.g. PLAY while a question is showing does nothing, so the learner can't skip it.
 */
export function reducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case "PLAY":
      return state.phase === "ready" || state.phase === "paused" || state.phase === "ended"
        ? { ...state, phase: "playing", error: null }
        : state;

    case "PAUSE":
      return state.phase === "playing" ? { ...state, phase: "paused" } : state;

    case "REACHED_CHECKPOINT":
      if (state.answered[event.checkpointId]) return state; // answered before: don't ask again
      if (state.phase === "checkpoint" || state.phase === "submitting" || state.phase === "feedback") return state;
      return {
        ...state,
        phase: "checkpoint",
        activeCheckpointId: event.checkpointId,
        selectedOptionId: null,
        feedback: null,
        error: null,
      };

    case "SELECT":
      return state.phase === "checkpoint" ? { ...state, selectedOptionId: event.optionId, error: null } : state;

    case "SUBMIT":
      return state.phase === "checkpoint" && state.selectedOptionId ? { ...state, phase: "submitting", error: null } : state;

    case "SUBMIT_OK":
      if (state.phase !== "submitting" || !state.activeCheckpointId) return state;
      return {
        ...state,
        phase: "feedback",
        // Store the answer the server kept (the first one, if this was answered elsewhere).
        answered: { ...state.answered, [state.activeCheckpointId]: event.result.response.optionId },
        feedback: event.result,
      };

    case "SUBMIT_FAIL":
      // Back to the question with the answer still selected, so the learner can retry.
      return state.phase === "submitting" ? { ...state, phase: "checkpoint", error: event.message } : state;

    case "CONTINUE":
      return state.phase === "feedback"
        ? { ...state, phase: "playing", activeCheckpointId: null, selectedOptionId: null, feedback: null }
        : state;

    case "ENDED":
      return state.phase === "playing" ? { ...state, phase: "ended" } : state;
  }
}

/** First unanswered checkpoint in time order, or undefined. */
export function nextUnanswered(checkpoints: DecisionCheckpoint[], answered: Record<ID, ID>) {
  return [...checkpoints]
    .sort((a, b) => a.timestampSec - b.timestampSec)
    .find((c) => !answered[c.id]);
}

/** The checkpoint that should be showing at time `t`, if playback has reached one. */
export function dueCheckpoint(checkpoints: DecisionCheckpoint[], answered: Record<ID, ID>, t: number) {
  const next = nextUnanswered(checkpoints, answered);
  return next && t >= next.timestampSec - CHECKPOINT_EPSILON ? next : undefined;
}

/**
 * The furthest point the learner may seek to (decision D4): what they've already
 * watched, and never past a question they haven't answered yet.
 */
export function maxSeekable(checkpoints: DecisionCheckpoint[], answered: Record<ID, ID>, furthestSec: number) {
  const next = nextUnanswered(checkpoints, answered);
  return next ? Math.min(furthestSec, next.timestampSec) : furthestSec;
}

/** Where a seek to `target` actually lands. Rewinding is always allowed. */
export function clampSeek(target: number, limit: number) {
  return Math.max(0, Math.min(target, limit));
}

/** Advance the furthest-watched point during normal playback, never past an unanswered question. */
export function advanceFurthest(
  checkpoints: DecisionCheckpoint[],
  answered: Record<ID, ID>,
  furthestSec: number,
  t: number,
) {
  const next = nextUnanswered(checkpoints, answered);
  const capped = next ? Math.min(t, next.timestampSec) : t;
  return Math.max(furthestSec, capped);
}

/** Map saved responses to the engine's `answered` record. */
export function answeredFrom(responses: { checkpointId: ID; optionId: ID }[]): Record<ID, ID> {
  return Object.fromEntries(responses.map((r) => [r.checkpointId, r.optionId]));
}

export function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
