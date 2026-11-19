"use client";

import { useState } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { Button, Card, CardBody, Field, TextArea } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { assessmentProblems, MAX_OPTIONS, type QuestionDraft } from "@/lib/content";
import type { KnowledgeAssessment } from "@/lib/types";

let tempId = 0;
const newTemp = () => `new-${Date.now().toString(36)}-${++tempId}`;

const blankQuestion = (): QuestionDraft => ({
  id: newTemp(),
  text: "",
  feedback: "",
  options: [0, 1, 2, 3].map((i) => ({ id: newTemp(), label: "", isCorrect: i === 0 })),
});

/**
 * Knowledge check (F5.7): pass mark, attempt limit (D6), questions with one correct answer
 * and optional explanation. Questions/answers learners have used are locked against deletion.
 */
export function AssessmentEditor({
  moduleId,
  assessment,
  answeredQuestionIds,
  answeredOptionIds,
}: {
  moduleId: string;
  assessment?: KnowledgeAssessment;
  answeredQuestionIds: string[];
  answeredOptionIds: string[];
}) {
  const [passPercent, setPassPercent] = useState(assessment?.passPercent ?? 80);
  const [limited, setLimited] = useState(assessment?.maxAttempts != null);
  const [maxAttempts, setMaxAttempts] = useState(assessment?.maxAttempts ?? 3);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    () => assessment?.questions.map((q) => ({ ...q, feedback: q.feedback ?? "" })) ?? [blankQuestion()],
  );
  const [dirty, setDirty] = useState(!assessment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lockedQ = new Set(answeredQuestionIds);
  const lockedO = new Set(answeredOptionIds);

  const draft = { passPercent: Number(passPercent), maxAttempts: limited ? Number(maxAttempts) : null, questions };
  const problems = assessmentProblems(draft);
  if (questions.length === 0) problems.unshift("Add at least one question.");

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };
  const updateQ = (id: string, patch: Partial<QuestionDraft>) => {
    touch();
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  async function save() {
    if (problems.length) return setError("Fix the problems listed above before saving.");
    setSaving(true);
    setError(null);
    try {
      const a = await data.saveAssessment(moduleId, draft);
      setQuestions(a.questions.map((q) => ({ ...q, feedback: q.feedback ?? "" })));
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't save the knowledge check.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Field
            label="Pass mark (%)"
            type="number"
            min={1}
            max={100}
            value={passPercent}
            onChange={(e) => {
              touch();
              setPassPercent(Number(e.target.value));
            }}
            hint="Default 80% — confirm with the client (D6)."
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={limited}
              onChange={(e) => {
                touch();
                setLimited(e.target.checked);
              }}
            />
            Limit attempts
          </label>
          {limited ? (
            <Field
              label="Attempts allowed"
              type="number"
              min={1}
              value={maxAttempts}
              onChange={(e) => {
                touch();
                setMaxAttempts(Number(e.target.value));
              }}
            />
          ) : (
            <p className="text-sm text-muted">Unlimited retakes until passed.</p>
          )}
        </CardBody>
      </Card>

      {questions.map((q, i) => {
        const qLocked = lockedQ.has(q.id);
        return (
          <Card key={q.id}>
            <CardBody className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Question {i + 1}</p>
              <TextArea label="Question" rows={2} value={q.text} onChange={(e) => updateQ(q.id, { text: e.target.value })} />
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Answers — select the correct one</legend>
                {q.options.map((o, j) => {
                  const oLocked = lockedO.has(o.id);
                  return (
                    <div key={o.id} className="flex items-end gap-2">
                      <label className="mb-2.5 flex items-center" title="Correct answer">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          aria-label={`Option ${String.fromCharCode(65 + j)} is correct`}
                          checked={o.isCorrect}
                          onChange={() => updateQ(q.id, { options: q.options.map((x) => ({ ...x, isCorrect: x.id === o.id })) })}
                          className="accent-[var(--success)]"
                        />
                      </label>
                      <div className="flex-1">
                        <Field
                          label={`Option ${String.fromCharCode(65 + j)}${o.isCorrect ? " (correct)" : ""}`}
                          value={o.label}
                          onChange={(e) => updateQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={oLocked || q.options.length <= 2}
                        title={oLocked ? "Learners have chosen this answer, so it can't be removed" : undefined}
                        onClick={() => updateQ(q.id, { options: q.options.filter((x) => x.id !== o.id) })}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
                {q.options.length < MAX_OPTIONS && (
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => updateQ(q.id, { options: [...q.options, { id: newTemp(), label: "", isCorrect: false }] })}>
                      Add answer
                    </Button>
                  </div>
                )}
              </fieldset>
              <TextArea
                label="Explanation (optional)"
                rows={2}
                value={q.feedback ?? ""}
                onChange={(e) => updateQ(q.id, { feedback: e.target.value })}
                hint="Shown to learners after they pass."
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  disabled={qLocked}
                  onClick={() => {
                    touch();
                    setQuestions((qs) => qs.filter((x) => x.id !== q.id));
                  }}
                >
                  {qLocked ? "Answered by learners — can't delete" : "Delete question"}
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })}

      <div>
        <Button
          variant="secondary"
          onClick={() => {
            touch();
            setQuestions((qs) => [...qs, blankQuestion()]);
          }}
        >
          Add question
        </Button>
      </div>

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
      {saved && <FormAlert tone="success">Knowledge check saved.</FormAlert>}
      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 backdrop-blur sm:bottom-4">
        <span className="text-sm text-muted">{dirty ? "Unsaved changes" : `${questions.length} question${questions.length === 1 ? "" : "s"}`}</span>
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Save knowledge check
        </Button>
      </div>
    </div>
  );
}
