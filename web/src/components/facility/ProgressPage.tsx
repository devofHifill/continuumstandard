"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, formatDate, LoadError, StatusBadge } from "@/components/learner/parts";
import { Card, CardBody, Table, Td, Th } from "@/components/ui";
import { data, type AssignmentRow } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { STATUS_LABEL } from "@/lib/learning";
import type { ProgressStatus } from "@/lib/types";
import { FilterBar, learnerHref, matches, SearchInput, Select } from "./parts";

type StatusFilter = "ALL" | ProgressStatus | "NEEDS_ATTENTION";

/** Facility-wide progress and results (F4.6), filterable by module, status and learner. */
export function ProgressPage() {
  const q = useQuery("facility-assignments", () => data.listFacilityAssignments());
  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const all = q.data ?? [];
  const modules = [...new Map(all.map((r) => [r.module.id, r.module])).values()];
  const needsAttention = (r: AssignmentRow) => r.lockedOut || (r.status !== "COMPLETED" && r.attemptsCount > 0);
  const rows = all.filter(
    (r) =>
      (moduleId === "ALL" || r.module.id === moduleId) &&
      (status === "ALL" || (status === "NEEDS_ATTENTION" ? needsAttention(r) : r.status === status)) &&
      matches(search, r.learner.name, r.learner.email),
  );

  return (
    <>
      <PageHeader title="Learner Progress" description="Training status and knowledge-check results across your facility." />

      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" && all.length === 0 && (
        <EmptyState title="No assignments yet">
          <Link href="/facility/assignments" className="text-primary underline">
            Assign training
          </Link>{" "}
          to start tracking progress.
        </EmptyState>
      )}

      {q.status === "success" && all.length > 0 && (
        <div className="flex flex-col gap-6">
          <ModuleSummaries rows={all} />

          <div>
            <FilterBar>
              <SearchInput label="Learner" placeholder="Search by name or email" value={search} onChange={setSearch} />
              <Select
                label="Module"
                value={moduleId}
                onChange={setModuleId}
                options={[{ value: "ALL", label: "All modules" }, ...modules.map((m) => ({ value: m.id, label: m.title }))]}
              />
              <Select<StatusFilter>
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "ALL", label: "All" },
                  { value: "NOT_STARTED", label: STATUS_LABEL.NOT_STARTED },
                  { value: "IN_PROGRESS", label: STATUS_LABEL.IN_PROGRESS },
                  { value: "COMPLETED", label: STATUS_LABEL.COMPLETED },
                  { value: "NEEDS_ATTENTION", label: "Needs attention" },
                ]}
              />
            </FilterBar>

            {rows.length === 0 ? (
              <EmptyState title="Nothing matches these filters" />
            ) : (
              <Card>
                <Table>
                  <caption className="sr-only">Progress by learner and module</caption>
                  <thead>
                    <tr>
                      <Th>Learner</Th>
                      <Th>Module</Th>
                      <Th>Status</Th>
                      <Th>Decision points</Th>
                      <Th>Knowledge check</Th>
                      <Th>Completed</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.assignmentId}>
                        <Td>
                          <Link href={learnerHref(r.learner.id)} className="font-medium hover:underline">
                            {r.learner.name}
                          </Link>
                          {r.learner.status === "DEACTIVATED" && <div className="text-xs text-muted">Deactivated</div>}
                        </Td>
                        <Td>{r.module.title}</Td>
                        <Td>
                          <StatusBadge status={r.status} />
                        </Td>
                        <Td>
                          {r.answeredCount}/{r.checkpointCount}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {r.bestScorePercent === null ? (
                            <span className="text-muted">Not taken</span>
                          ) : (
                            <>
                              <span className={r.status === "COMPLETED" ? "text-success" : undefined}>
                                {r.bestScorePercent}%
                              </span>
                              <span className="text-muted">
                                {" "}
                                · {r.attemptsCount} attempt{r.attemptsCount === 1 ? "" : "s"}
                              </span>
                              {r.lockedOut && <div className="text-xs text-warning">All attempts used</div>}
                            </>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">{formatDate(r.completedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ModuleSummaries({ rows }: { rows: AssignmentRow[] }) {
  // (Not Map.groupBy — it's missing from Safari before 17.4.)
  const groups = new Map<string, AssignmentRow[]>();
  for (const r of rows) groups.set(r.module.id, [...(groups.get(r.module.id) ?? []), r]);
  const byModule = [...groups.values()];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {byModule.map((list) => {
        const done = list.filter((r) => r.status === "COMPLETED").length;
        const scores = list.filter((r) => r.bestScorePercent !== null).map((r) => r.bestScorePercent!);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return (
          <Card key={list[0].module.id}>
            <CardBody className="flex flex-col gap-2">
              <p className="font-semibold">{list[0].module.title}</p>
              <p className="text-sm text-muted">
                {done} of {list.length} completed · {list.filter((r) => r.status === "IN_PROGRESS").length} in progress
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                <div className="h-full bg-primary" style={{ width: `${(done / list.length) * 100}%` }} />
              </div>
              <p className="text-sm">
                Average best score: <strong>{avg === null ? "—" : `${avg}%`}</strong>
              </p>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
