import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Placeholder for a page whose content arrives in a later phase. */
export function ComingSoon({ phase, items }: { phase: string; items: string[] }) {
  return (
    <Card className="border-dashed">
      <CardBody className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Coming in phase {phase}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
