import { describe, expect, it } from "vitest";
import type { CheckpointResult } from "@/lib/data";
import type { DecisionCheckpoint } from "@/lib/types";
import {
  advanceFurthest,
  answeredFrom,
  clampSeek,
  dueCheckpoint,
  formatTime,
  initialState,
  maxSeekable,
  reducer,
  type PlayerState,
} from "./engine";

const cp = (id: string, timestampSec: number): DecisionCheckpoint => ({
  id,
  videoId: "v",
  timestampSec,
  prompt: "?",
  options: [
    { id: `${id}-a`, label: "A" },
    { id: `${id}-b`, label: "B" },
  ],
  sortOrder: 0,
});

// Deliberately out of order: the engine must sort by time.
const checkpoints = [cp("late", 95), cp("early", 30)];

const result = (checkpointId: string, optionId: string): CheckpointResult => ({
  response: { id: "r", userId: "u", checkpointId, optionId, answeredAt: "" },
  option: { id: optionId, label: "A" },
  alreadyAnswered: false,
});

function run(state: PlayerState, ...events: Parameters<typeof reducer>[1][]) {
  return events.reduce(reducer, state);
}

describe("dueCheckpoint", () => {
  it("is nothing before the first checkpoint", () => {
    expect(dueCheckpoint(checkpoints, {}, 29.9)).toBeUndefined();
  });
  it("triggers at the timestamp (within epsilon)", () => {
    expect(dueCheckpoint(checkpoints, {}, 29.96)?.id).toBe("early");
    expect(dueCheckpoint(checkpoints, {}, 30)?.id).toBe("early");
  });
  it("returns the earliest unanswered one even if time is past a later one", () => {
    expect(dueCheckpoint(checkpoints, {}, 120)?.id).toBe("early");
  });
  it("skips answered checkpoints", () => {
    expect(dueCheckpoint(checkpoints, { early: "early-a" }, 40)).toBeUndefined();
    expect(dueCheckpoint(checkpoints, { early: "early-a" }, 95)?.id).toBe("late");
  });
});

describe("seeking (decision D4)", () => {
  it("can't seek past what was watched", () => {
    expect(maxSeekable(checkpoints, { early: "x" }, 50)).toBe(50);
  });
  it("can't seek past an unanswered checkpoint", () => {
    expect(maxSeekable(checkpoints, {}, 80)).toBe(30);
  });
  it("clamps forward seeks and allows rewinds", () => {
    expect(clampSeek(200, 50)).toBe(50);
    expect(clampSeek(10, 50)).toBe(10);
    expect(clampSeek(-5, 50)).toBe(0);
  });
  it("furthest point grows with playback but stops at an unanswered checkpoint", () => {
    expect(advanceFurthest(checkpoints, {}, 10, 20)).toBe(20);
    expect(advanceFurthest(checkpoints, {}, 20, 31)).toBe(30);
    expect(advanceFurthest(checkpoints, { early: "x" }, 30, 31)).toBe(31);
    expect(advanceFurthest(checkpoints, {}, 25, 5)).toBe(25); // rewinding never lowers it
  });
});

describe("reducer", () => {
  it("runs the happy path: play → checkpoint → answer → feedback → continue", () => {
    let s = run(initialState(), { type: "PLAY" }, { type: "REACHED_CHECKPOINT", checkpointId: "early" });
    expect(s.phase).toBe("checkpoint");

    s = run(s, { type: "SELECT", optionId: "early-b" }, { type: "SUBMIT" });
    expect(s.phase).toBe("submitting");

    s = reducer(s, { type: "SUBMIT_OK", result: result("early", "early-b") });
    expect(s.phase).toBe("feedback");
    expect(s.answered).toEqual({ early: "early-b" });

    s = reducer(s, { type: "CONTINUE" });
    expect(s.phase).toBe("playing");
    expect(s.activeCheckpointId).toBeNull();
  });

  it("ignores PLAY while a question is showing (can't skip it)", () => {
    const s = run(initialState(), { type: "PLAY" }, { type: "REACHED_CHECKPOINT", checkpointId: "early" });
    expect(reducer(s, { type: "PLAY" }).phase).toBe("checkpoint");
  });

  it("won't submit without a selected answer", () => {
    const s = run(initialState(), { type: "PLAY" }, { type: "REACHED_CHECKPOINT", checkpointId: "early" });
    expect(reducer(s, { type: "SUBMIT" }).phase).toBe("checkpoint");
  });

  it("returns to the question with the answer kept when saving fails", () => {
    const s = run(
      initialState(),
      { type: "PLAY" },
      { type: "REACHED_CHECKPOINT", checkpointId: "early" },
      { type: "SELECT", optionId: "early-a" },
      { type: "SUBMIT" },
      { type: "SUBMIT_FAIL", message: "offline" },
    );
    expect(s.phase).toBe("checkpoint");
    expect(s.selectedOptionId).toBe("early-a");
    expect(s.error).toBe("offline");
    expect(s.answered).toEqual({});
  });

  it("keeps the server's first answer when the checkpoint was already answered", () => {
    const s = run(
      initialState(),
      { type: "PLAY" },
      { type: "REACHED_CHECKPOINT", checkpointId: "early" },
      { type: "SELECT", optionId: "early-b" },
      { type: "SUBMIT" },
      { type: "SUBMIT_OK", result: { ...result("early", "early-a"), alreadyAnswered: true } },
    );
    expect(s.answered.early).toBe("early-a");
  });

  it("doesn't re-ask an answered checkpoint on a repeat visit", () => {
    const s = run(initialState({ early: "early-a" }), { type: "PLAY" }, { type: "REACHED_CHECKPOINT", checkpointId: "early" });
    expect(s.phase).toBe("playing");
  });

  it("can replay after the video ends", () => {
    const s = run(initialState(), { type: "PLAY" }, { type: "ENDED" });
    expect(s.phase).toBe("ended");
    expect(reducer(s, { type: "PLAY" }).phase).toBe("playing");
  });
});

describe("helpers", () => {
  it("builds the answered map from saved responses", () => {
    expect(answeredFrom([{ checkpointId: "early", optionId: "early-a" }])).toEqual({ early: "early-a" });
  });
  it("formats mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(95.7)).toBe("01:35");
    expect(formatTime(NaN)).toBe("00:00");
  });
});
