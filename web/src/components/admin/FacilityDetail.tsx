"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { formatDate, LoadError } from "@/components/learner/parts";
import { StatCard, UserStatusBadge } from "@/components/facility/parts";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";

/**
 * One facility from the platform's point of view (read-only "basic activity", scope doc §6.8).
 * Reuses the Facility Admin endpoints — the Super Admin just names the facility.
 */
export function FacilityDetail() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const summary = useQuery(`facility-summary:${facilityId}`, () => data.getFacilitySummary(facilityId));
  const learners = useQuery(`facility-learners:${facilityId}`, () => data.listFacilityLearners(facilityId));
  const admins = useQuery("facility-admins", () => data.listFacilityAdmins());

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/facilities" className="text-sm font-medium text-primary hover:underline">
        ← Facilities
      </Link>
      {summary.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {summary.status === "error" && <LoadError error={summary.error} onRetry={summary.refetch} />}
      {summary.status === "success" && (
        <>
          <PageHeader
            title={summary.data.facility.name}
            description={`${summary.data.facility.contactName} · ${summary.data.facility.contactEmail}${summary.data.facility.phone ? ` · ${summary.data.facility.phone}` : ""}`}
            actions={!summary.data.facility.isActive && <Badge>Inactive</Badge>}
          />
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active learners" value={summary.data.learners.active} hint={`${summary.data.learners.invited} invite pending`} />
            <StatCard label="Assignments" value={summary.data.assignments.total} />
            <StatCard label="Completion" value={`${summary.data.completionPercent}%`} />
            <StatCard label="Average score" value={summary.data.averageScore === null ? "—" : `${summary.data.averageScore}%`} />
          </dl>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="font-semibold">Facility Admins</h2>
                <Link href="/admin/facility-admins" className="text-sm font-medium text-primary hover:underline">
                  Manage
                </Link>
              </CardHeader>
              <CardBody>
                {admins.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
                {admins.status === "error" && <LoadError error={admins.error} onRetry={admins.refetch} />}
                <ul className="flex flex-col divide-y divide-border">
                  {(admins.data ?? [])
                    .filter((a) => a.user.facilityId === facilityId)
                    .map((a) => (
                      <li key={a.user.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          <span className="font-medium">{a.user.name}</span>
                          <span className="block text-xs text-muted">{a.user.email}</span>
                        </span>
                        <UserStatusBadge status={a.user.status} />
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Recent activity</h2>
              </CardHeader>
              <CardBody>
                {summary.data.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted">No activity yet.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {summary.data.recentActivity.map((a) => (
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

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Learners</h2>
            </CardHeader>
            {learners.status === "loading" && <p className="px-5 py-4 text-sm text-muted">Loading…</p>}
            {learners.status === "error" && (
              <div className="px-5 py-4">
                <LoadError error={learners.error} onRetry={learners.refetch} />
              </div>
            )}
            <Table>
              <caption className="sr-only">Learners at this facility</caption>
              <thead>
                <tr>
                  <Th>Learner</Th>
                  <Th>Status</Th>
                  <Th>Training</Th>
                  <Th>Last activity</Th>
                </tr>
              </thead>
              <tbody>
                {(learners.data ?? []).map((r) => (
                  <tr key={r.user.id}>
                    <Td>
                      <span className="font-medium">{r.user.name}</span>
                      <div className="text-xs text-muted">{r.user.email}</div>
                    </Td>
                    <Td>
                      <UserStatusBadge status={r.user.status} />
                    </Td>
                    <Td>
                      {r.assigned ? `${r.completed}/${r.assigned} completed` : <span className="text-muted">None assigned</span>}
                    </Td>
                    <Td>{r.lastActivityAt ? formatDate(r.lastActivityAt) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
