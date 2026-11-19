import type { Metadata } from "next";
import { Suspense } from "react";
import { ModulePlay } from "@/components/learner/ModulePlay";

export const metadata: Metadata = { title: "Scenario" };

export default function Page() {
  // ModulePlay reads the module id with useParams, which needs a Suspense boundary for dynamic routes.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ModulePlay />
    </Suspense>
  );
}
