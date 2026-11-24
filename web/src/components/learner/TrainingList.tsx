"use client";

import clsx from "clsx";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { STATUS_LABEL } from "@/lib/learning";
import type { ProgressStatus } from "@/lib/types";
import { CardGridSkeleton, EmptyState, LoadError, TrainingCard } from "./parts";

type Filter = "ALL" | ProgressStatus;
const FILTERS: Filter[] = ["ALL", "NOT_STARTED", "IN_PROGRESS", "COMPLETED"];

export function TrainingList() {
  const training = useQuery("my-training", () => data.listMyTraining());
  const [filter, setFilter] = useState<Filter>("ALL");

  const items = training.data ?? [];
  const shown = filter === "ALL" ? items : items.filter((i) => i.status === filter);
  const count = (f: Filter) => (f === "ALL" ? items.length : items.filter((i) => i.status === f).length);

  return (
    <>
      <PageHeader title="Assigned Training" description="Modules your facility has assigned to you." />

      <div role="group" aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={clsx(
              "h-9 rounded-full border px-4 text-sm font-medium",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface hover:bg-surface-muted",
            )}
          >
            {f === "ALL" ? "All" : STATUS_LABEL[f]}
            {training.status === "success" && <span className="ml-1.5 opacity-75">{count(f)}</span>}
          </button>
        ))}
      </div>

      {training.status === "loading" && <CardGridSkeleton count={3} />}
      {training.status === "error" && <LoadError error={training.error} onRetry={training.refetch} />}
      {training.status === "success" &&
        (shown.length === 0 ? (
          <EmptyState title={items.length === 0 ? "No training assigned yet" : "Nothing here"}>
            {items.length === 0
              ? "When your facility assigns you a module, it will appear here."
              : "No modules match this filter."}
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <TrainingCard key={item.module.id} item={item} />
            ))}
          </div>
        ))}
    </>
  );
}
