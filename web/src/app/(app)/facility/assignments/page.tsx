import type { Metadata } from "next";
import { Suspense } from "react";
import { AssignmentsPage } from "@/components/facility/AssignmentsPage";

export const metadata: Metadata = { title: "Assignments" };

export default function Page() {
  // AssignmentsPage reads ?learner= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <AssignmentsPage />
    </Suspense>
  );
}
