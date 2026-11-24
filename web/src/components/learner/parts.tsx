"use client";

import Link from "next/link";
import clsx from "clsx";
import { Badge, type BadgeTone } from "@/components/ui";
import { ServiceError, type MyTrainingItem } from "@/lib/data";
import { STATUS_LABEL, STEP_LABEL, type NextStep } from "@/lib/learning";
import type { ID, ProgressStatus } from "@/lib/types";

export const moduleHref = (id: ID) => `/learn/training/${id}`;
export const playHref = (id: ID) => `/learn/training/${id}/play`;
export const checkHref = (id: ID) => `/learn/training/${id}/check`;

/** Where the main button for a module goes. Starting goes via the intro page (objectives first). */
export function stepHref(step: NextStep, id: ID) {
  if (step === "CONTINUE_VIDEO") return playHref(id);
  if (step === "TAKE_ASSESSMENT") return checkHref(id);
  return moduleHref(id);
}

const STATUS_TONE: Record<ProgressStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

export function StatusBadge({ status }: { status: ProgressStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Overall progress for a card: video watched counts 70%, passing the check the last 30%. */
export function overallProgress(item: MyTrainingItem) {
  if (item.status === "COMPLETED") return 1;
  const video = item.videoDurationSec ? Math.min(1, item.progress.furthestSec / item.videoDurationSec) : 0;
  return item.hasAssessment ? video * 0.7 : video;
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary-hover"
          : "border border-border bg-surface text-foreground hover:bg-surface-muted",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function TrainingCard({ item }: { item: MyTrainingItem }) {
  const m = item.module;
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <Link href={moduleHref(m.id)} className="block aspect-video bg-surface-muted" tabIndex={-1} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG placeholders, no optimisation needed */}
        <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="text-xs text-muted">
            {m.category} · {m.estimatedMinutes} min
          </span>
        </div>
        <h3 className="font-semibold leading-snug">
          <Link href={moduleHref(m.id)} className="hover:underline">
            {m.title}
          </Link>
        </h3>
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <ProgressBar value={overallProgress(item)} label={`${m.title} progress`} />
            <p className="text-xs text-muted">
              {item.answeredCount} of {item.checkpointCount} decision points
              {item.bestScorePercent !== null && ` · best score ${item.bestScorePercent}%`}
            </p>
          </div>
          <ButtonLink
            href={stepHref(item.nextStep, m.id)}
            variant={item.nextStep === "REVIEW" || item.nextStep === "LOCKED_OUT" ? "secondary" : "primary"}
          >
            {STEP_LABEL[item.nextStep]}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Error message for failed loads, with an optional "Try again" (F7.1). */
/** Errors a retry can't fix: the thing is gone or isn't yours, so "Try again" would just fail again. */
const FINAL_CODES = new Set(["NOT_FOUND", "FORBIDDEN"]);

export function LoadError({
  error,
  message = error?.message ?? "Something went wrong.",
  onRetry,
}: {
  error?: Error;
  message?: string;
  onRetry?: () => void;
}) {
  const canRetry = onRetry && !(error instanceof ServiceError && FINAL_CODES.has(error.code));
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <span>{message}</span>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-8 shrink-0 rounded-md border border-danger/30 bg-surface px-3 font-medium text-danger hover:bg-danger-soft"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-[var(--radius-card)] bg-surface-muted" />
      ))}
    </div>
  );
}
