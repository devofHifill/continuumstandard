import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnersPage } from "@/components/facility/LearnersPage";

export const metadata: Metadata = { title: "Learners" };

export default function Page() {
  // LearnersPage reads ?new=1 with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <LearnersPage />
    </Suspense>
  );
}
