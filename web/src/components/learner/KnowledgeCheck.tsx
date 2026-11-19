"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { data, ServiceError, type AssessmentResult, type LearnerAssessment } from "@/lib/data";
import { useResetOnHide } from "@/lib/useResetOnHide";
import type { ID } from "@/lib/types";
import { ButtonLink, LoadError, moduleHref, playHref } from "./parts";

/** Knowledge check (F3.5) and its result screen (F3.6). */
export function KnowledgeCheck() {
  const { moduleId } = useParams<{ moduleId: string }>();
  return <Check key={moduleId} moduleId={moduleId} />;
}

function Check({ moduleId }: { moduleId: string }) {
  const [assessment, setAssessment] = useState<LearnerAssessment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<ID, ID>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const resultRef = useRef<HTMLHeadingElement>(null);

  // Loaded on demand (not live-refreshing): the check must not change under the learner mid-attempt.
  useEffect(() => {
    let cancelled = false;
    data.getMyAssessment(moduleId).then(
      (a) => !cancelled && setAssessment(a),
      (e: Error) => !cancelled && setLoadError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [moduleId, loadCount]);

  // A finished attempt shouldn't greet the learner if they come back later: start fresh.
  useResetOnHide(() => {
    if (!result) return;
    setResult(null);
    setAnswers({});
    setAssessment(null);
    setLoadError(null);
    setLoadCount((n) => n + 1);
  });

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  function retry() {
    setResult(null);
    setAnswers({});
    setSubmitError(null);
    setAssessment(null);
    setLoadCount((n) => n + 1);
    window.scrollTo({ top: 0 });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!assessment) return;
    const missing = assessment.questions.filter((q) => !answers[q.id]).length;
    if (missing) return setSubmitError(`Answer every question before submitting (${missing} left).`);
    setSubmitting(true);
    setSubmitError(null);
    try {
      setResult(await data.submitAssessment(moduleId, answers));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(err instanceof ServiceError ? err.message : "Your answers couldn't be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const back = (
    <Link href={moduleHref(moduleId)} className="text-sm font-medium text-primary hover:underline">
      ← Back to module
    </Link>
  );

  if (result) return <Result result={result} moduleId={moduleId} onRetry={retry} headingRef={resultRef} />;

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <LoadError message={loadError} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={moduleHref(moduleId)} variant="secondary">
            Back to module
          </ButtonLink>
          {/watch/i.test(loadError) && <ButtonLink href={playHref(moduleId)}>Continue the scenario</ButtonLink>}
        </div>
      </div>
    );
  }
  if (!assessment) return <p className="text-sm text-muted">Loading knowledge check…</p>;

  const answered = assessment.questions.filter((q) => answers[q.id]).length;
  const total = assessment.questions.length;

  return (
    <div className="flex flex-col gap-5">
      {back}
      <div>
        <h1 className="text-2xl font-semibold">Knowledge check</h1>
        <p className="mt-1 text-muted">
          {total} questions · pass mark {assessment.passPercent}% ·{" "}
          {assessment.attemptsRemaining === null
            ? "you can retake it if needed"
            : `${assessment.attemptsRemaining} attempt${assessment.attemptsRemaining === 1 ? "" : "s"} left`}
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {assessment.questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
            <legend className="sr-only">
              Question {i + 1} of {total}
            </legend>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Question {i + 1} of {total}
            </p>
            <p className="mt-1 font-medium">{q.text}</p>
            <div className="mt-3 flex flex-col gap-2">
              {q.options.map((o) => (
                <label
                  key={o.id}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm",
                    answers[q.id] === o.id ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={o.id}
                    checked={answers[q.id] === o.id}
                    onChange={() => {
                      setAnswers((a) => ({ ...a, [q.id]: o.id }));
                      setSubmitError(null);
                    }}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface/95 p-4 shadow-sm backdrop-blur sm:bottom-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" aria-live="polite">
            {answered} of {total} answered
          </p>
          {submitError && (
            <p role="alert" className="text-sm text-danger">
              {submitError}
            </p>
          )}
          <Button type="submit" size="lg" loading={submitting} disabled={answered < total}>
            Submit answers
          </Button>
        </div>
      </form>
    </div>
  );
}

function Result({
  result,
  moduleId,
  onRetry,
  headingRef,
}: {
  result: AssessmentResult;
  moduleId: string;
  onRetry: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const { passed, scorePercent } = result.attempt;
  const canRetry = !passed && result.attemptsRemaining !== 0;

  return (
    <div className="flex flex-col gap-5">
      <Card className={passed ? "border-success/40" : "border-warning/40"}>
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          <Badge tone={passed ? "success" : "warning"}>{passed ? "Passed" : "Not passed yet"}</Badge>
          <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-semibold outline-none">
            {scorePercent}%
          </h1>
          <p className="text-muted">
            {result.correctCount} of {result.total} correct · pass mark {result.passPercent}%
          </p>
          <p className="max-w-md text-sm">
            {passed
              ? "Well done — this module is now complete."
              : canRetry
                ? "Review the scenario if you like, then try again."
                : "You've used all your attempts. Contact your facility administrator."}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {canRetry && <Button onClick={onRetry}>Try again</Button>}
            {!passed && (
              <ButtonLink href={playHref(moduleId)} variant="secondary">
                Rewatch scenario
              </ButtonLink>
            )}
            <ButtonLink href={passed ? "/learn/training" : moduleHref(moduleId)} variant={passed ? "primary" : "secondary"}>
              {passed ? "Back to my training" : "Back to module"}
            </ButtonLink>
          </div>
          {canRetry && result.attemptsRemaining !== null && (
            <p className="text-xs text-muted">{result.attemptsRemaining} attempts left</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Your answers</h2>
          {!result.answersRevealed && (
            <p className="mt-1 text-sm text-muted">Correct answers are shown once you pass.</p>
          )}
        </CardHeader>
        <ol className="divide-y divide-border">
          {result.review.map((r, i) => (
            <li key={r.questionId} className="flex flex-col gap-1.5 px-5 py-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  {i + 1}. {r.text}
                </p>
                <Badge tone={r.correct ? "success" : "danger"}>{r.correct ? "Correct" : "Incorrect"}</Badge>
              </div>
              <p>
                <span className="text-muted">Your answer: </span>
                {r.chosenLabel}
              </p>
              {r.correctLabel && !r.correct && (
                <p>
                  <span className="text-muted">Correct answer: </span>
                  {r.correctLabel}
                </p>
              )}
              {r.feedback && <p className="rounded-lg bg-surface-muted px-3 py-2">{r.feedback}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
