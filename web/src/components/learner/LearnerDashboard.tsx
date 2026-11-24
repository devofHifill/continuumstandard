"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery, useSession } from "@/lib/data/hooks";
import { STEP_LABEL } from "@/lib/learning";
import {
  ButtonLink,
  CardGridSkeleton,
  EmptyState,
  formatDate,
  LoadError,
  overallProgress,
  ProgressBar,
  stepHref,
  TrainingCard,
} from "./parts";

export function LearnerDashboard() {
  const session = useSession();
  const training = useQuery("my-training", () => data.listMyTraining());
  const activity = useQuery("my-activity", () => data.listMyActivity(6));
  if (!session) return null;

  const items = training.data ?? [];
  const counts = {
    assigned: items.length,
    inProgress: items.filter((i) => i.status === "IN_PROGRESS").length,
    completed: items.filter((i) => i.status === "COMPLETED").length,
  };
  // "Continue where you left off": the in-progress module touched most recently.
  const resume = items
    .filter((i) => i.status === "IN_PROGRESS")
    .sort((a, b) => b.progress.updatedAt.localeCompare(a.progress.updatedAt))[0];

  return (
    <>
      <PageHeader title={`Welcome, ${session.name.split(/\s+/)[0]}`} description="Your training at a glance." />

      {training.status === "error" && <LoadError error={training.error} onRetry={training.refetch} />}
      {training.status === "loading" && <CardGridSkeleton />}

      {training.status === "success" && (
        <div className="flex flex-col gap-8">
          <dl className="grid grid-cols-3 gap-3">
            {(
              [
                ["Assigned", counts.assigned],
                ["In progress", counts.inProgress],
                ["Completed", counts.completed],
              ] as const
            ).map(([label, value]) => (
              <Card key={label}>
                <CardBody>
                  <dt className="text-xs text-muted sm:text-sm">{label}</dt>
                  <dd className="text-2xl font-semibold">{value}</dd>
                </CardBody>
              </Card>
            ))}
          </dl>

          {items.length === 0 ? (
            <EmptyState title="No training assigned yet">
              When your facility assigns you a module, it will appear here.
            </EmptyState>
          ) : (
            <>
              {resume && (
                <section aria-labelledby="resume-heading">
                  <Card className="border-primary/40 bg-primary-soft/40">
                    <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p id="resume-heading" className="text-xs font-semibold uppercase tracking-wide text-primary">
                          Continue where you left off
                        </p>
                        <p className="mt-1 truncate font-semibold">{resume.module.title}</p>
                        <div className="mt-2 max-w-sm">
                          <ProgressBar value={overallProgress(resume)} label={`${resume.module.title} progress`} />
                        </div>
                      </div>
                      <ButtonLink href={stepHref(resume.nextStep, resume.module.id)}>
                        {STEP_LABEL[resume.nextStep]}
                      </ButtonLink>
                    </CardBody>
                  </Card>
                </section>
              )}

              <section aria-labelledby="training-heading" className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 id="training-heading" className="text-lg font-semibold">
                    Your training
                  </h2>
                  <Link href="/learn/training" className="text-sm font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.slice(0, 6).map((item) => (
                    <TrainingCard key={item.module.id} item={item} />
                  ))}
                </div>
              </section>
            </>
          )}

          <section aria-labelledby="activity-heading">
            <Card>
              <CardHeader>
                <h2 id="activity-heading" className="font-semibold">
                  Recent activity
                </h2>
              </CardHeader>
              <CardBody>
                {activity.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
                {activity.status === "error" && (
                  <p role="alert" className="text-sm text-danger">
                    Couldn&apos;t load activity. {activity.error.message}
                  </p>
                )}
                {activity.status === "success" && activity.data.length === 0 && (
                  <p className="text-sm text-muted">Nothing yet — your training activity will show here.</p>
                )}
                {activity.status === "success" && activity.data.length > 0 && (
                  <ul className="flex flex-col divide-y divide-border">
                    {activity.data.map((a) => (
                      <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span>{a.message}</span>
                        <span className="shrink-0 text-xs text-muted">{formatDate(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
