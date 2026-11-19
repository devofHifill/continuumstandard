"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import type { CheckpointResult } from "@/lib/data";
import type { DecisionCheckpoint, ID } from "@/lib/types";

type Props = {
  checkpoint: DecisionCheckpoint;
  index: number;
  total: number;
  phase: "checkpoint" | "submitting" | "feedback";
  selectedOptionId: ID | null;
  feedback: CheckpointResult | null;
  error: string | null;
  onSelect: (optionId: ID) => void;
  onSubmit: () => void;
  onContinue: () => void;
};

/**
 * The decision-point panel: question → answer → approved feedback → continue.
 * Focus moves here when it opens so keyboard and screen-reader users land on the question.
 */
export function CheckpointPanel(props: Props) {
  const { checkpoint, index, total, phase, selectedOptionId, feedback, error, onSelect, onSubmit, onContinue } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase === "feedback") continueRef.current?.focus();
    else headingRef.current?.focus();
  }, [phase, checkpoint.id]);

  const label = `Decision point ${index + 1} of ${total}`;

  if (phase === "feedback" && feedback) {
    return (
      <section aria-label={label} className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label} · Feedback</p>
        <div>
          <p className="text-sm text-muted">Your response</p>
          <p className="font-medium">{feedback.option.label}</p>
          {feedback.alreadyAnswered && (
            <p className="mt-1 text-sm text-muted">You answered this earlier — your first answer is kept.</p>
          )}
        </div>
        {feedback.option.rationale && (
          <div className="rounded-lg bg-primary-soft px-4 py-3 text-sm">{feedback.option.rationale}</div>
        )}
        {feedback.generalRationale && (
          <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm">{feedback.generalRationale}</div>
        )}
        <div>
          <Button ref={continueRef} size="lg" onClick={onContinue}>
            Continue video
          </Button>
        </div>
      </section>
    );
  }

  const submitting = phase === "submitting";
  return (
    <section aria-label={label} className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
        {checkpoint.prompt}
      </h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <fieldset disabled={submitting} className="flex flex-col gap-2">
          <legend className="sr-only">Choose your response</legend>
          {checkpoint.options.map((o) => (
            <label
              key={o.id}
              className={clsx(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                selectedOptionId === o.id ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name={`cp-${checkpoint.id}`}
                value={o.id}
                checked={selectedOptionId === o.id}
                onChange={() => onSelect(o.id)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error} Your answer is still selected — try again.
          </p>
        )}
        <div>
          <Button type="submit" size="lg" disabled={!selectedOptionId} loading={submitting}>
            {error ? "Try again" : "Submit answer"}
          </Button>
        </div>
      </form>
    </section>
  );
}
