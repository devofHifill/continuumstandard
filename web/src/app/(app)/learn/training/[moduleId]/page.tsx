import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleIntro } from "@/components/learner/ModuleIntro";

export const metadata: Metadata = { title: "Training module" };

export default function Page() {
  // ModuleIntro reads the module id with useParams, which needs a Suspense boundary for dynamic routes.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ModuleIntro />
    </Suspense>
  );
}
