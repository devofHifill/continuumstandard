"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink, formatDate, LoadError } from "@/components/learner/parts";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery, useSession } from "@/lib/data/hooks";
import { learnerHref, StatCard } from "./parts";

const ATTENTION_LABEL = {
  INVITE_PENDING: "Invite pending",
  LOCKED_OUT: "Locked out",
  FAILED_CHECK: "Not passed yet",
} as const;

/** Facility Admin home (F4.1): the facility at a glance, what needs attention, quick actions. */
export function FacilityDashboard() {
  const session = useSession();
  const q = useQuery("facility-summary", () => data.getFacilitySummary());
  if (!session) return null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.name.split(/\s+/)[0]}`}
        description={q.data ? q.data.facility.name : "Your facility at a glance."}
      />
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" && (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Active learners"
              value={q.data.learners.active}
              hint={q.data.learners.invited ? `${q.data.learners.invited} invite pending` : undefined}
            />
            <StatCard
              label="Assignments"
              value={q.data.assignments.total}
              hint={`${q.data.assignments.inProgress} in progress · ${q.data.assignments.notStarted} not started`}
            />
            <StatCard label="Completion" value={`${q.data.completionPercent}%`} hint={`${q.data.assignments.completed} completed`} />
            <StatCard label="Average score" value={q.data.averageScore === null ? "—" : `${q.data.averageScore}%`} hint="Best attempt per assignment" />
          </dl>

          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/facility/learners?new=1">Add learner</ButtonLink>
            <ButtonLink href="/facility/assignments" variant="secondary">
              Assign training
            </ButtonLink>
            <ButtonLink href="/facility/progress" variant="secondary">
              View progress
            </ButtonLink>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Needs attention</h2>
              </CardHeader>
              <CardBody>
                {q.data.attention.length === 0 ? (
                  <p className="text-sm text-muted">Nothing needs your attention right now.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {q.data.attention.map((a, i) => (
                      <li key={`${a.kind}-${a.userId}-${i}`} className="flex flex-col gap-0.5 py-2.5 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link href={learnerHref(a.userId)} className="font-medium hover:underline">
                            {a.userName}
                          </Link>
                          <span className="shrink-0 text-xs font-medium text-warning">{ATTENTION_LABEL[a.kind]}</span>
                        </div>
                        <span className="text-muted">
                          {a.moduleTitle ? `${a.moduleTitle} — ` : ""}
                          {a.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold">Recent activity</h2>
              </CardHeader>
              <CardBody>
                {q.data.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted">No activity yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {q.data.recentActivity.map((a) => (
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
        </div>
      )}
    </>
  );
}
