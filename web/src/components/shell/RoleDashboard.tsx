"use client";

import { ScopedDataPreview } from "@/components/dev/ScopedDataPreview";
import { useSession } from "@/lib/data/hooks";
import { DEMO_TOOLS_ENABLED } from "@/lib/data/mock/demo";
import { ComingSoon, PageHeader } from "./PageHeader";

/** Temporary dashboard for each role until its real one is built (F3–F5). */
export function RoleDashboard({ phase, items }: { phase: string; items: string[] }) {
  const session = useSession();
  if (!session) return null;
  const first = session.name.split(/\s+/)[0];
  return (
    <>
      <PageHeader title={`Welcome, ${first}`} description="Here's an overview of your account." />
      <div className="flex flex-col gap-6">
        <ComingSoon phase={phase} items={items} />
        {DEMO_TOOLS_ENABLED && <ScopedDataPreview session={session} />}
      </div>
    </>
  );
}
