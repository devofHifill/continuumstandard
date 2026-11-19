"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { data, type MyTrainingDetail } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { STEP_LABEL } from "@/lib/learning";
import { formatTime } from "@/lib/player/engine";
import { ButtonLink, formatDate, LoadError, overallProgress, playHref, ProgressBar, StatusBadge, stepHref } from "./parts";

/** Module page: intro before starting, status while in progress, read-only review once complete (D7). */
export function ModuleIntro() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const q = useQuery(`my-training:${moduleId}`, () => data.getMyTraining(moduleId));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/learn/training" className="text-sm font-medium text-primary hover:underline">
        ← Assigned Training
      </Link>
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" && <Detail item={q.data} />}
    </div>
  );
}

function Detail({ item }: { item: MyTrainingDetail }) {
  const m = item.module;
  const completed = item.status === "COMPLETED";
  const passed = item.attempts.find((a) => a.passed);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <Badge>{m.category}</Badge>
            {m.isPlaceholder && <Badge tone="warning">Placeholder content</Badge>}
          </div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{m.title}</h1>
          <p className="text-muted">{m.description}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="inline text-muted">Time: </dt>
              <dd className="inline">about {m.estimatedMinutes} min</dd>
            </div>
            <div>
              <dt className="inline text-muted">Decision points: </dt>
              <dd className="inline">{item.checkpointCount}</dd>
            </div>
            {item.hasAssessment && (
              <div>
                <dt className="inline text-muted">Knowledge check: </dt>
                <dd className="inline">
                  {item.questionCount} questions, pass mark {item.passPercent}%
                </dd>
              </div>
            )}
          </dl>
          {m.learningObjectives.length > 0 && (
            <div>
              <h2 className="font-semibold">What you&apos;ll practise</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {m.learningObjectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Card className="self-start">
          {/* The thumbnail shows a play icon, so it should play. Not focusable: the button below does the same. */}
          {item.nextStep === "LOCKED_OUT" ? (
            // eslint-disable-next-line @next/next/no-img-element -- local SVG placeholder
            <img src={m.thumbnailUrl} alt="" className="aspect-video w-full rounded-t-[var(--radius-card)] object-cover" />
          ) : (
            <Link href={playHref(m.id)} tabIndex={-1} aria-hidden className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- local SVG placeholder */}
              <img src={m.thumbnailUrl} alt="" className="aspect-video w-full rounded-t-[var(--radius-card)] object-cover" />
            </Link>
          )}
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <ProgressBar value={overallProgress(item)} label="Module progress" />
              <ul className="text-sm text-muted">
                <li>
                  Scenario video:{" "}
                  {item.progress.videoCompleted
                    ? "watched"
                    : item.progress.furthestSec > 0
                      ? `watched to ${formatTime(item.progress.furthestSec)}`
                      : "not started"}
                </li>
                <li>
                  Decision points answered: {item.answeredCount} of {item.checkpointCount}
                </li>
                {item.hasAssessment && (
                  <li>
                    Knowledge check:{" "}
                    {passed
                      ? `passed with ${passed.scorePercent}%`
                      : item.attempts.length
                        ? `best ${item.bestScorePercent}% after ${item.attempts.length} attempt${item.attempts.length > 1 ? "s" : ""}`
                        : "not taken"}
                  </li>
                )}
                {completed && <li>Completed {formatDate(item.progress.completedAt)}</li>}
              </ul>
            </div>

            {item.nextStep === "LOCKED_OUT" ? (
              <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                You&apos;ve used all your knowledge-check attempts. Contact your facility administrator.
              </p>
            ) : (
              <ButtonLink href={item.nextStep === "START" ? playHref(m.id) : stepHref(item.nextStep, m.id)}>
                {item.nextStep === "REVIEW" ? "Watch again" : STEP_LABEL[item.nextStep]}
              </ButtonLink>
            )}
            {item.nextStep === "TAKE_ASSESSMENT" && (
              <ButtonLink href={playHref(m.id)} variant="secondary">
                Rewatch scenario
              </ButtonLink>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Read-only review of the learner's own decisions (D7) — once they've answered any. */}
      {item.decisions.some((d) => d.response) && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Your decisions</h2>
          </CardHeader>
          <ol className="divide-y divide-border">
            {item.decisions.map(({ checkpoint, response }, i) => {
              const chosen = checkpoint.options.find((o) => o.id === response?.optionId);
              return (
                <li key={checkpoint.id} className="flex flex-col gap-2 px-5 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Decision point {i + 1} · {formatTime(checkpoint.timestampSec)}
                  </p>
                  <p className="font-medium">{checkpoint.prompt}</p>
                  {response ? (
                    <>
                      <p>
                        <span className="text-muted">Your response: </span>
                        {chosen?.label}
                      </p>
                      {chosen?.rationale && <p className="rounded-lg bg-primary-soft px-3 py-2">{chosen.rationale}</p>}
                      {checkpoint.generalRationale && (
                        <p className="rounded-lg bg-surface-muted px-3 py-2">{checkpoint.generalRationale}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted">Not answered yet.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}
