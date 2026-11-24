"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink, formatDate, LoadError } from "@/components/learner/parts";
import { StatCard } from "@/components/facility/parts";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";

/** Super Admin home (F5.1): platform totals, facility overview, quick actions, activity. */
export function AdminDashboard() {
  const q = useQuery("platform-summary", () => data.getPlatformSummary());

  return (
    <>
      <PageHeader title="Platform overview" description="Facilities, learners and training across The Continuum-Standard." />
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError error={q.error} onRetry={q.refetch} />}
      {q.status === "success" && (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Facilities"
              value={q.data.facilities.active}
              hint={q.data.facilities.inactive ? `${q.data.facilities.inactive} inactive` : "All active"}
            />
            <StatCard
              label="Active learners"
              value={q.data.learners.active}
              hint={`${q.data.learners.invited} invite pending · ${q.data.admins} facility admins`}
            />
            <StatCard
              label="Training modules"
              value={q.data.modules.active}
              hint={`${q.data.modules.draft} draft · ${q.data.modules.disabled} disabled`}
            />
            <StatCard
              label="Completion"
              value={`${q.data.completionPercent}%`}
              hint={`${q.data.assignments.completed} of ${q.data.assignments.total} assignments`}
            />
          </dl>

          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/facilities?new=1">Create facility</ButtonLink>
            <ButtonLink href="/admin/facility-admins?new=1" variant="secondary">
              Add Facility Admin
            </ButtonLink>
            <ButtonLink href="/admin/content" variant="secondary">
              Manage training content
            </ButtonLink>
            <ButtonLink href="/admin/leads" variant="secondary">
              Demo requests ({q.data.leads})
            </ButtonLink>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Facilities</h2>
              </CardHeader>
              <Table>
                <caption className="sr-only">Facilities overview</caption>
                <thead>
                  <tr>
                    <Th>Facility</Th>
                    <Th>Learners</Th>
                    <Th>Assignments</Th>
                    <Th>Completion</Th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.facilityRows.map((r) => (
                    <tr key={r.facility.id}>
                      <Td>
                        <Link href={`/admin/facilities/${r.facility.id}`} className="font-medium hover:underline">
                          {r.facility.name}
                        </Link>
                        {!r.facility.isActive && (
                          <span className="ml-2">
                            <Badge>Inactive</Badge>
                          </span>
                        )}
                      </Td>
                      <Td>{r.learners}</Td>
                      <Td>{r.assignments}</Td>
                      <Td>{r.completionPercent}%</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="font-semibold">Recent activity</h2>
                <Link href="/admin/activity" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardBody>
                <ul className="flex flex-col divide-y divide-border">
                  {q.data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span>{a.message}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
