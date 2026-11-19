import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnerDetail } from "@/components/facility/LearnerDetail";

export const metadata: Metadata = { title: "Learner" };

export default function Page() {
  // LearnerDetail reads the learner id with useParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <LearnerDetail />
    </Suspense>
  );
}
