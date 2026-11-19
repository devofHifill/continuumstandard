"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { EmptyState, formatDate, LoadError, ProgressBar, overallProgress, StatusBadge, ButtonLink } from "@/components/learner/parts";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { data, type MyTrainingDetail } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { formatTime } from "@/lib/player/engine";
import { DemoInviteLink, LearnerActionButtons, useLearnerActions } from "./LearnerActions";
import { LearnerFormModal } from "./LearnerFormModal";
import { UserStatusBadge } from "./parts";

/** One learner's full record (F4.7): account, every assignment, decisions and knowledge-check attempts. */
export function LearnerDetail() {
  const { userId } = useParams<{ userId: string }>();
  const q = useQuery(`learner-report:${userId}`, () => data.getLearnerReport(userId));
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const actions = useLearnerActions(setNotice);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/facility/learners" className="text-sm font-medium text-primary hover:underline">
        ← Learners
      </Link>
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{q.data.learner.name}</h1>
                <UserStatusBadge status={q.data.learner.status} />
              </div>
              <p className="mt-1 text-muted">
                {q.data.learner.email}
                {q.data.learner.jobTitle && ` · ${q.data.learner.jobTitle}`}
              </p>
              {q.data.learner.status === "INVITED" && (
                <p className="mt-1 text-sm text-warning">
                  Hasn&apos;t set up their account yet. <DemoInviteLink email={q.data.learner.email} />
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {q.data.learner.status !== "DEACTIVATED" && (
                <ButtonLink href={`/facility/assignments?learner=${q.data.learner.id}`}>Assign training</ButtonLink>
              )}
              <LearnerActionButtons user={q.data.learner} onEdit={() => setEditing(true)} ask={actions.ask} />
            </div>
          </div>

          {notice && <FormAlert tone="success">{notice}</FormAlert>}

          <section className="flex flex-col gap-4" aria-labelledby="training-heading">
            <h2 id="training-heading" className="text-lg font-semibold">
              Training ({q.data.items.length})
            </h2>
            {q.data.items.length === 0 ? (
              <EmptyState title="No training assigned">Use “Assign training” to give this learner a module.</EmptyState>
            ) : (
              q.data.items.map((item) => <ModuleRecord key={item.module.id} item={item} />)
            )}
          </section>

          <LearnerFormModal
            open={editing}
            learner={q.data.learner}
            onClose={() => setEditing(false)}
            onSaved={(u) => {
              setEditing(false);
              setNotice(`${u.name}'s details were saved.`);
            }}
          />
          {actions.dialog}
        </>
      )}
    </div>
  );
}

function ModuleRecord({ item }: { item: MyTrainingDetail }) {
  const passed = item.attempts.find((a) => a.passed);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{item.module.title}</h3>
          <p className="text-xs text-muted">Assigned {formatDate(item.assignedAt)}</p>
        </div>
        <StatusBadge status={item.status} />
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted">Progress</p>
            <ProgressBar value={overallProgress(item)} label={`${item.module.title} progress`} />
            <p className="text-sm">
              {item.progress.videoCompleted ? "Video watched" : item.progress.furthestSec > 0 ? `Watched to ${formatTime(item.progress.furthestSec)}` : "Not started"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Decision points</p>
            <p className="text-sm">
              {item.answeredCount} of {item.checkpointCount} answered
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Knowledge check</p>
            <p className="text-sm">
              {passed
                ? `Passed · ${passed.scorePercent}%`
                : item.attempts.length
                  ? `Not passed · best ${item.bestScorePercent}%`
                  : "Not taken"}
              {item.passPercent !== null && <span className="text-muted"> (pass {item.passPercent}%)</span>}
            </p>
            {item.nextStep === "LOCKED_OUT" && <p className="text-sm text-warning">All attempts used</p>}
            {item.status === "COMPLETED" && <p className="text-sm text-muted">Completed {formatDate(item.progress.completedAt)}</p>}
          </div>
        </div>

        {item.attempts.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Attempts</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {[...item.attempts].reverse().map((a, i) => (
                <li key={a.id} className="rounded-lg border border-border px-3 py-1.5">
                  #{i + 1} · {a.scorePercent}% {a.passed ? "✓ passed" : "· not passed"} · {formatDate(a.submittedAt)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.decisions.some((d) => d.response) && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-primary">Decision-point responses</summary>
            <ol className="mt-3 flex flex-col gap-3">
              {item.decisions.map(({ checkpoint, response }, i) => (
                <li key={checkpoint.id} className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
                  <p className="text-xs text-muted">
                    Decision point {i + 1} · {formatTime(checkpoint.timestampSec)}
                  </p>
                  <p className="font-medium">{checkpoint.prompt}</p>
                  <p>
                    <span className="text-muted">Response: </span>
                    {response ? checkpoint.options.find((o) => o.id === response.optionId)?.label : "Not answered yet"}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </CardBody>
    </Card>
  );
}
