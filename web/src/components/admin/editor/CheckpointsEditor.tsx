"use client";

import { useRef, useState } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { Button, Card, CardBody, Field, TextArea } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { checkpointProblems, MAX_OPTIONS, type CheckpointDraft } from "@/lib/content";
import { formatTime } from "@/lib/player/engine";
import type { DecisionCheckpoint, ScenarioVideo } from "@/lib/types";
import { parseTime, PreviewVideo } from "./PreviewVideo";

let tempId = 0;
const newTemp = () => `new-${Date.now().toString(36)}-${++tempId}`;

type Row = CheckpointDraft & { timeText: string };

const toRow = (c: DecisionCheckpoint): Row => ({
  id: c.id,
  timestampSec: c.timestampSec,
  timeText: formatTime(c.timestampSec),
  prompt: c.prompt,
  generalRationale: c.generalRationale ?? "",
  options: c.options.map((o) => ({ ...o, rationale: o.rationale ?? "" })),
});

/**
 * Decision points (F5.6): when the video pauses, what it asks, the answer options, and the
 * approved feedback — a general rationale and/or one per option (D5). Items learners have
 * already answered are locked against deletion (their records point at them).
 */
export function CheckpointsEditor({
  moduleId,
  video,
  checkpoints,
  answeredCheckpointIds,
  answeredOptionIds,
}: {
  moduleId: string;
  video?: ScenarioVideo;
  checkpoints: DecisionCheckpoint[];
  answeredCheckpointIds: string[];
  answeredOptionIds: string[];
}) {
  const [rows, setRows] = useState<Row[]>(() => checkpoints.map(toRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lockedCp = new Set(answeredCheckpointIds);
  const lockedOpt = new Set(answeredOptionIds);

  if (!video) {
    return <p className="text-sm text-muted">Add the scenario video first — decision points are placed on its timeline.</p>;
  }

  const drafts: CheckpointDraft[] = rows.map((r) => ({
    id: r.id,
    timestampSec: r.timestampSec,
    prompt: r.prompt,
    generalRationale: r.generalRationale,
    options: r.options,
  }));
  const problems = checkpointProblems(drafts, video.durationSec);
  const now = () => videoRef.current?.currentTime ?? 0;

  const update = (id: string, patch: Partial<Row>) => {
    setDirty(true);
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const setOption = (cpId: string, optId: string, patch: { label?: string; rationale?: string }) => {
    setDirty(true);
    setSaved(false);
    setRows((rs) =>
      rs.map((r) => (r.id === cpId ? { ...r, options: r.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)) } : r)),
    );
  };

  function add() {
    const t = Math.max(1, Math.round(now() * 10) / 10);
    setDirty(true);
    setSaved(false);
    setRows((rs) => [
      ...rs,
      {
        id: newTemp(),
        timestampSec: t,
        timeText: formatTime(t),
        prompt: "",
        generalRationale: "",
        options: [
          { id: newTemp(), label: "", rationale: "" },
          { id: newTemp(), label: "", rationale: "" },
        ],
      },
    ]);
  }

  async function save() {
    if (problems.length) return setError("Fix the problems listed above before saving.");
    setSaving(true);
    setError(null);
    try {
      const savedRows = await data.saveCheckpoints(moduleId, drafts);
      setRows(savedRows.map(toRow));
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't save decision points.");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...rows].sort((a, b) => a.timestampSec - b.timestampSec);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
        <PreviewVideo src={video.sourceUrl} videoRef={videoRef} />
        <p className="text-sm text-muted">
          Play or scrub to the moment the scenario should pause, then press <strong>Add decision point here</strong> or a card&apos;s{" "}
          <strong>Use current time</strong>.
        </p>
        <Button onClick={add}>Add decision point here</Button>
      </div>

      <div className="flex flex-col gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted">No decision points yet.</p>}
        {sorted.map((c, i) => {
          const locked = lockedCp.has(c.id);
          return (
            <Card key={c.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-2">
                  <p className="mr-auto text-sm font-semibold">Decision point {i + 1}</p>
                  <div className="w-28">
                    <Field
                      label="Pause at"
                      value={c.timeText}
                      onChange={(e) => {
                        const sec = parseTime(e.target.value);
                        update(c.id, { timeText: e.target.value, timestampSec: Number.isFinite(sec) ? sec : NaN });
                      }}
                      hint="m:ss"
                    />
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => update(c.id, { timestampSec: Math.round(now() * 10) / 10, timeText: formatTime(now()) })}>
                    Use current time
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (videoRef.current && Number.isFinite(c.timestampSec)) videoRef.current.currentTime = Math.max(0, c.timestampSec - 3);
                    }}
                  >
                    Preview
                  </Button>
                </div>
                <TextArea label="Question" rows={2} value={c.prompt} onChange={(e) => update(c.id, { prompt: e.target.value })} />
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">Answer options</legend>
                  {c.options.map((o, j) => {
                    const optLocked = lockedOpt.has(o.id);
                    return (
                      <div key={o.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Field label={`Option ${String.fromCharCode(65 + j)}`} value={o.label} onChange={(e) => setOption(c.id, o.id, { label: e.target.value })} />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={optLocked || c.options.length <= 2}
                            title={optLocked ? "Learners have chosen this option, so it can't be removed" : undefined}
                            onClick={() => update(c.id, { options: c.options.filter((x) => x.id !== o.id) })}
                          >
                            Remove
                          </Button>
                        </div>
                        <Field
                          label="Feedback for this option (optional)"
                          value={o.rationale ?? ""}
                          onChange={(e) => setOption(c.id, o.id, { rationale: e.target.value })}
                        />
                        {optLocked && <p className="text-xs text-muted">Chosen by learners — can be reworded, not removed.</p>}
                      </div>
                    );
                  })}
                  {c.options.length < MAX_OPTIONS && (
                    <div>
                      <Button size="sm" variant="secondary" onClick={() => update(c.id, { options: [...c.options, { id: newTemp(), label: "", rationale: "" }] })}>
                        Add option
                      </Button>
                    </div>
                  )}
                </fieldset>
                <TextArea
                  label="General feedback (shown after any answer)"
                  rows={2}
                  value={c.generalRationale ?? ""}
                  onChange={(e) => update(c.id, { generalRationale: e.target.value })}
                  hint="Client-approved rationale. Required unless every option has its own feedback."
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    disabled={locked}
                    title={locked ? "Learners have answered this decision point, so it can't be deleted" : undefined}
                    onClick={() => {
                      setDirty(true);
                      setRows((rs) => rs.filter((r) => r.id !== c.id));
                    }}
                  >
                    {locked ? "Answered by learners — can't delete" : "Delete decision point"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {problems.length > 0 && (
          <div role="status" className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
            <p className="font-semibold">Before saving:</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <FormAlert>{error}</FormAlert>}
        {saved && <FormAlert tone="success">Decision points saved.</FormAlert>}
        <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 backdrop-blur sm:bottom-4">
          <span className="text-sm text-muted">{dirty ? "Unsaved changes" : `${rows.length} decision point${rows.length === 1 ? "" : "s"}`}</span>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Save decision points
          </Button>
        </div>
      </div>
    </div>
  );
}
