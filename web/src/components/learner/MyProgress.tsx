"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { EmptyState, formatDate, LoadError, moduleHref, StatusBadge } from "./parts";

export function MyProgress() {
  const training = useQuery("my-training", () => data.listMyTraining());
  const activity = useQuery("my-activity:20", () => data.listMyActivity(20));
  const items = training.data ?? [];
  const completed = items.filter((i) => i.status === "COMPLETED").length;

  return (
    <>
      <PageHeader title="My Progress" description="Your training status and knowledge-check results." />
      {training.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {training.status === "error" && <LoadError error={training.error} onRetry={training.refetch} />}
      {training.status === "success" && (
        <div className="flex flex-col gap-6">
          {items.length === 0 ? (
            <EmptyState title="No training assigned yet" />
          ) : (
            <Card>
              <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">Modules</h2>
                <p className="text-sm text-muted">
                  {completed} of {items.length} completed
                </p>
              </CardHeader>
              <Table>
                <caption className="sr-only">Your modules with status and results</caption>
                <thead>
                  <tr>
                    <Th>Module</Th>
                    <Th>Status</Th>
                    <Th>Decision points</Th>
                    <Th>Best score</Th>
                    <Th>Attempts</Th>
                    <Th>Completed</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.module.id}>
                      <Td className="font-medium">
                        <Link href={moduleHref(i.module.id)} className="hover:underline">
                          {i.module.title}
                        </Link>
                      </Td>
                      <Td>
                        <StatusBadge status={i.status} />
                      </Td>
                      <Td>
                        {i.answeredCount} / {i.checkpointCount}
                      </Td>
                      <Td>
                        {i.bestScorePercent === null ? (
                          "—"
                        ) : (
                          <span className={i.attempts.some((a) => a.passed) ? "text-success" : undefined}>
                            {i.bestScorePercent}%
                          </span>
                        )}
                        {i.passPercent !== null && <span className="text-muted"> (pass {i.passPercent}%)</span>}
                      </Td>
                      <Td>{i.attempts.length}</Td>
                      <Td>{formatDate(i.progress.completedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Activity history</h2>
            </CardHeader>
            <CardBody>
              {activity.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
                {activity.status === "error" && (
                  <p role="alert" className="text-sm text-danger">
                    Couldn&apos;t load activity. {activity.error.message}
                  </p>
                )}
                {activity.status === "success" && activity.data.length === 0 && (
                <p className="text-sm text-muted">No activity yet.</p>
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
        </div>
      )}
    </>
  );
}
