"use client";

import clsx from "clsx";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, formatDate, LoadError, StatusBadge } from "@/components/learner/parts";
import { Button, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui";
import { data, ServiceError, type AssignResult } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { ID } from "@/lib/types";
import { FilterBar, learnerHref, matches, SearchInput } from "./parts";

/** Assign training (F4.4) and the list of assignments (F4.5). */
export function AssignmentsPage() {
  const preselected = useSearchParams().get("learner");
  return (
    <>
      <PageHeader title="Assignments" description="Give learners training modules and see what's assigned." />
      <div className="flex flex-col gap-8">
        <AssignForm key={preselected ?? "none"} preselected={preselected} />
        <AssignmentList />
      </div>
    </>
  );
}

function AssignForm({ preselected }: { preselected: string | null }) {
  // listModules() returns only ACTIVE modules to a Facility Admin — drafts can't be assigned.
  const modules = useQuery("modules", () => data.listModules());
  const learners = useQuery("facility-learners", () => data.listFacilityLearners());
  const assignments = useQuery("facility-assignments", () => data.listFacilityAssignments());

  const [moduleIds, setModuleIds] = useState<ID[]>([]);
  const [userIds, setUserIds] = useState<ID[]>(preselected ? [preselected] : []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: ID[], id: ID) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const assignable = (learners.data ?? []).filter((r) => r.user.status !== "DEACTIVATED");
  const shown = assignable.filter((r) => matches(search, r.user.name, r.user.email, r.user.jobTitle));
  const already = new Set((assignments.data ?? []).map((a) => `${a.learner.id}:${a.module.id}`));
  const newPairs = userIds.reduce((n, u) => n + moduleIds.filter((m) => !already.has(`${u}:${m}`)).length, 0);

  async function submit() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      setResult(await data.assignTraining(userIds, moduleIds));
      setModuleIds([]);
      setUserIds([]);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't assign training. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const allShownSelected = shown.length > 0 && shown.every((r) => userIds.includes(r.user.id));

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Assign training</h2>
        <p className="mt-1 text-sm text-muted">Choose one or more modules, then one or more learners.</p>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        {result && (
          <FormAlert tone="success">
            {result.created === 0
              ? "Nothing new to assign — those learners already had those modules."
              : `${result.created} new assignment${result.created === 1 ? "" : "s"} created.`}
            {result.created > 0 &&
              result.skipped > 0 &&
              ` ${result.skipped} ${result.skipped === 1 ? "was" : "were"} already assigned and left unchanged.`}
          </FormAlert>
        )}
        {error && <FormAlert>{error}</FormAlert>}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">1. Modules</legend>
          {modules.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
          {modules.status === "success" && modules.data.length === 0 && (
            <p className="text-sm text-muted">No published modules are available yet.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {(modules.data ?? []).map((m) => (
              <label
                key={m.id}
                className={clsx(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm",
                  moduleIds.includes(m.id) ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-muted",
                )}
              >
                <input
                  type="checkbox"
                  checked={moduleIds.includes(m.id)}
                  onChange={() => setModuleIds((l) => toggle(l, m.id))}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{m.title}</span>
                  <span className="text-xs text-muted">
                    {m.category} · {m.estimatedMinutes} min
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">2. Learners</legend>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <SearchInput label="Find learners" placeholder="Name, email or job title" value={search} onChange={setSearch} />
            <Button
              variant="secondary"
              disabled={shown.length === 0}
              onClick={() =>
                setUserIds((l) =>
                  allShownSelected
                    ? l.filter((id) => !shown.some((r) => r.user.id === id))
                    : [...new Set([...l, ...shown.map((r) => r.user.id)])],
                )
              }
            >
              {allShownSelected ? "Clear shown" : `Select all shown (${shown.length})`}
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {shown.length === 0 && <p className="px-4 py-3 text-sm text-muted">No learners match.</p>}
            <ul className="divide-y divide-border">
              {shown.map((r) => {
                const has = moduleIds.filter((m) => already.has(`${r.user.id}:${m}`)).length;
                return (
                  <li key={r.user.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        checked={userIds.includes(r.user.id)}
                        onChange={() => setUserIds((l) => toggle(l, r.user.id))}
                        className="accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.user.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {r.user.jobTitle ?? r.user.email}
                          {r.user.status === "INVITED" && " · invite pending"}
                        </span>
                      </span>
                      {has > 0 && (
                        <span className="shrink-0 text-xs text-muted">
                          already has {has === moduleIds.length && has === 1 ? "this" : `${has} of these`}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" aria-live="polite">
            {moduleIds.length} module{moduleIds.length === 1 ? "" : "s"} × {userIds.length} learner
            {userIds.length === 1 ? "" : "s"}
            {moduleIds.length > 0 && userIds.length > 0 && (
              <span className="text-muted">
                {" "}
                → {newPairs} new assignment{newPairs === 1 ? "" : "s"}
              </span>
            )}
          </p>
          <Button onClick={submit} loading={saving} disabled={!moduleIds.length || !userIds.length}>
            Assign training
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function AssignmentList() {
  const q = useQuery("facility-assignments", () => data.listFacilityAssignments());
  const [search, setSearch] = useState("");
  const rows = (q.data ?? []).filter((r) => matches(search, r.learner.name, r.module.title));

  return (
    <section aria-labelledby="list-heading">
      <h2 id="list-heading" className="mb-3 text-lg font-semibold">
        All assignments
      </h2>
      <FilterBar>
        <SearchInput label="Search" placeholder="Learner or module" value={search} onChange={setSearch} />
      </FilterBar>
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" &&
        (rows.length === 0 ? (
          <EmptyState title={q.data.length ? "No assignments match" : "No assignments yet"} />
        ) : (
          <Card>
            <Table>
              <caption className="sr-only">Assignments in your facility</caption>
              <thead>
                <tr>
                  <Th>Learner</Th>
                  <Th>Module</Th>
                  <Th>Assigned</Th>
                  <Th>Assigned by</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assignmentId}>
                    <Td>
                      <Link href={learnerHref(r.learner.id)} className="font-medium hover:underline">
                        {r.learner.name}
                      </Link>
                    </Td>
                    <Td>{r.module.title}</Td>
                    <Td className="whitespace-nowrap">{formatDate(r.assignedAt)}</Td>
                    <Td>{r.assignedByName}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
    </section>
  );
}
