"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, LoadError } from "@/components/learner/parts";
import { FilterBar, Select } from "@/components/facility/parts";
import { Card } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { ActivityEvent } from "@/lib/types";

const TYPE_LABEL: Record<ActivityEvent["type"], string> = {
  LEAD_RECEIVED: "Demo request",
  FACILITY_CREATED: "Facility created",
  FACILITY_DEACTIVATED: "Facility deactivated",
  FACILITY_REACTIVATED: "Facility reactivated",
  USER_CREATED: "Account created",
  USER_DEACTIVATED: "Account deactivated",
  USER_REACTIVATED: "Account reactivated",
  INVITE_SENT: "Invite sent",
  MODULE_ASSIGNED: "Training assigned",
  MODULE_STARTED: "Module started",
  MODULE_COMPLETED: "Module completed",
  ASSESSMENT_SUBMITTED: "Knowledge check",
  CONTENT_UPDATED: "Content edited",
  MODULE_STATUS_CHANGED: "Module status",
};

/** Basic platform activity (F5.8) — who did what, filterable by facility and type. */
export function ActivityPage() {
  const facilities = useQuery("facility-rows", () => data.listFacilityRows());
  const [facilityId, setFacilityId] = useState("ALL");
  const [type, setType] = useState<"ALL" | ActivityEvent["type"]>("ALL");
  const q = useQuery(`activity:${facilityId}:${type}`, () =>
    data.listActivity({ facilityId: facilityId === "ALL" ? undefined : facilityId, type: type === "ALL" ? undefined : type }),
  );
  const facilityName = new Map((facilities.data ?? []).map((f) => [f.facility.id, f.facility.name]));

  return (
    <>
      <PageHeader title="Activity" description="Recent actions across the platform (latest 200)." />
      <FilterBar>
        <Select
          label="Facility"
          value={facilityId}
          onChange={setFacilityId}
          options={[{ value: "ALL", label: "All facilities" }, ...(facilities.data ?? []).map((f) => ({ value: f.facility.id, label: f.facility.name }))]}
        />
        <Select<"ALL" | ActivityEvent["type"]>
          label="Type"
          value={type}
          onChange={setType}
          options={[{ value: "ALL", label: "All types" }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: value as ActivityEvent["type"], label }))]}
        />
      </FilterBar>
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError error={q.error} onRetry={q.refetch} />}
      {q.status === "success" &&
        (q.data.length === 0 ? (
          <EmptyState title="No activity matches" />
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {q.data.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 px-5 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span>
                    {a.message}
                    <span className="block text-xs text-muted">
                      {TYPE_LABEL[a.type]}
                      {a.facilityId && ` · ${facilityName.get(a.facilityId) ?? ""}`}
                    </span>
                  </span>
                  <time dateTime={a.createdAt} className="shrink-0 text-xs text-muted">
                    {new Date(a.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </>
  );
}
