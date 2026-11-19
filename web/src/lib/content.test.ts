import { describe, expect, it } from "vitest";
import { assessmentProblems, checkpointProblems, isSafeMediaUrl, publishProblems, type CheckpointDraft } from "./content";

const cp = (id: string, t: number, extra: Partial<CheckpointDraft> = {}): CheckpointDraft => ({
  id,
  timestampSec: t,
  prompt: "What next?",
  options: [
    { id: `${id}-a`, label: "A" },
    { id: `${id}-b`, label: "B" },
  ],
  generalRationale: "Because.",
  ...extra,
});

describe("checkpointProblems", () => {
  it("accepts valid decision points", () => {
    expect(checkpointProblems([cp("1", 30), cp("2", 95)], 600)).toEqual([]);
  });
  it("rejects times outside the video or too close together", () => {
    expect(checkpointProblems([cp("1", 0)], 600).join()).toMatch(/after the start/);
    expect(checkpointProblems([cp("1", 700)], 600).join()).toMatch(/past the end/);
    expect(checkpointProblems([cp("1", 30), cp("2", 31)], 600).join()).toMatch(/too close/);
  });
  it("requires a question, 2+ options and feedback (D5)", () => {
    const bad = cp("1", 30, { prompt: " ", options: [{ id: "x", label: "Only" }], generalRationale: "" });
    const msg = checkpointProblems([bad], 600).join(" | ");
    expect(msg).toMatch(/write the question/);
    expect(msg).toMatch(/at least 2/);
    expect(msg).toMatch(/add feedback/);
  });
  it("accepts per-option feedback instead of a general rationale", () => {
    const perOption = cp("1", 30, {
      generalRationale: "",
      options: [
        { id: "a", label: "A", rationale: "Why A" },
        { id: "b", label: "B", rationale: "Why B" },
      ],
    });
    expect(checkpointProblems([perOption], 600)).toEqual([]);
  });
});

describe("assessmentProblems", () => {
  const q = (correct: number) => ({
    id: "q",
    text: "Q?",
    options: [0, 1, 2].map((i) => ({ id: `o${i}`, label: `O${i}`, isCorrect: i < correct })),
  });
  it("needs exactly one correct answer per question", () => {
    expect(assessmentProblems({ passPercent: 80, maxAttempts: null, questions: [q(1)] })).toEqual([]);
    expect(assessmentProblems({ passPercent: 80, maxAttempts: null, questions: [q(0)] }).join()).toMatch(/exactly one/);
    expect(assessmentProblems({ passPercent: 80, maxAttempts: null, questions: [q(2)] }).join()).toMatch(/exactly one/);
  });
  it("validates pass mark and attempts (D6)", () => {
    expect(assessmentProblems({ passPercent: 0, maxAttempts: null, questions: [] }).join()).toMatch(/Pass mark/);
    expect(assessmentProblems({ passPercent: 80, maxAttempts: 0, questions: [] }).join()).toMatch(/Attempts/);
  });
});

describe("publishProblems", () => {
  const details = { title: "T", description: "D", category: "C", estimatedMinutes: 10 };
  it("lists everything missing from an empty draft", () => {
    const p = publishProblems({ module: details, video: undefined, checkpoints: [], assessment: undefined }).join(" | ");
    expect(p).toMatch(/video/);
    expect(p).toMatch(/decision point/);
    expect(p).toMatch(/question/);
  });
  it("passes a complete module", () => {
    const assessment = { passPercent: 80, maxAttempts: null, questions: [{ id: "q", text: "Q", options: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] }] };
    expect(publishProblems({ module: details, video: { sourceUrl: "https://x.test/v.m3u8", durationSec: 600 }, checkpoints: [cp("1", 30)], assessment })).toEqual([]);
  });
});

describe("isSafeMediaUrl", () => {
  it("allows http(s) and same-site paths only", () => {
    expect(isSafeMediaUrl("https://stream.test/a.m3u8")).toBe(true);
    expect(isSafeMediaUrl("/thumbnails/x.svg")).toBe(true);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("data:text/html,hi")).toBe(false);
    expect(isSafeMediaUrl("//evil.test/x")).toBe(false);
  });
});
