"use client";

import clsx from "clsx";
import { useId, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui";
import type { ID, UserStatus } from "@/lib/types";

export const learnerHref = (id: ID) => `/facility/learners/${id}`;

const USER_TONE: Record<UserStatus, BadgeTone> = { ACTIVE: "success", INVITED: "warning", DEACTIVATED: "neutral" };
const USER_LABEL: Record<UserStatus, string> = { ACTIVE: "Active", INVITED: "Invited", DEACTIVATED: "Deactivated" };

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={USER_TONE[status]}>{USER_LABEL[status]}</Badge>;
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
      />
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  label,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  label: string;
  options: { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 rounded-lg border border-border bg-surface px-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">{children}</div>;
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "success" }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-4">
      <dt className="text-xs text-muted sm:text-sm">{label}</dt>
      <dd className={clsx("text-2xl font-semibold", tone === "success" && "text-success")}>{value}</dd>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Case-insensitive "does any of these fields contain the query". */
export function matches(query: string, ...fields: (string | undefined)[]) {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}
