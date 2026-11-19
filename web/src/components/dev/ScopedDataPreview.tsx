"use client";

import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { Session } from "@/lib/types";

/**
 * Demo panel: lists what the signed-in account is allowed to see, to show role +
 * facility scoping working. Shown on dashboards until real content replaces it.
 */
export function ScopedDataPreview({ session }: { session: Session }) {
  const isLearner = session.role === "LEARNER";
  const q = useQuery(`preview:${session.userId}`, async () => {
    const [facilities, users, modules, assignments, progress] = await Promise.all([
      data.listFacilities(),
      isLearner ? Promise.resolve([]) : data.listUsers(),
      data.listModules(),
      data.listAssignments(),
      data.listProgress(),
    ]);
    return { facilities, users, modules, assignments, progress };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg bg-info-soft px-4 py-3 text-sm text-info">
        Demo preview: everything the data layer lets this account see. Switch accounts in the demo toolbar to
        compare facilities. Real dashboard content arrives in a later phase.
      </div>

      {q.status === "loading" && <p className="text-sm text-muted">Loading data…</p>}
      {q.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {q.error.message}
        </p>
      )}
      {q.status === "success" && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Facilities", q.data.facilities.length],
              ["Users", isLearner ? "—" : q.data.users.length],
              ["Modules", q.data.modules.length],
              ["Assignments", q.data.assignments.length],
              ["Progress rows", q.data.progress.length],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardBody>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-2xl font-semibold">{value}</dd>
                </CardBody>
              </Card>
            ))}
          </dl>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Visible facilities</h2>
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {q.data.facilities.map((f) => (
                  <tr key={f.id}>
                    <Td className="font-medium">{f.name}</Td>
                    <Td>{f.contactEmail}</Td>
                    <Td>
                      <Badge tone={f.isActive ? "success" : "neutral"}>{f.isActive ? "Active" : "Inactive"}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {!isLearner && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Visible users</h2>
              </CardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Facility</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.users.map((u) => (
                    <tr key={u.id}>
                      <Td className="font-medium">{u.name}</Td>
                      <Td>{ROLE_LABEL[u.role]}</Td>
                      <Td>{q.data.facilities.find((f) => f.id === u.facilityId)?.name ?? "—"}</Td>
                      <Td>
                        <Badge tone={u.status === "ACTIVE" ? "success" : u.status === "INVITED" ? "warning" : "neutral"}>
                          {u.status.toLowerCase()}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Visible modules</h2>
            </CardHeader>
            <ul className="divide-y divide-border">
              {q.data.modules.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium">{m.title}</span>
                  <span className="flex gap-1">
                    {m.isPlaceholder && <Badge tone="warning">Placeholder content</Badge>}
                    <Badge tone={m.status === "ACTIVE" ? "success" : "neutral"}>{m.status.toLowerCase()}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

    </div>
  );
}
