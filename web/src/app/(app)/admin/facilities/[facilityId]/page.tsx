import type { Metadata } from "next";
import { Suspense } from "react";
import { FacilityDetail } from "@/components/admin/FacilityDetail";

export const metadata: Metadata = { title: "Facility" };

export default function Page() {
  // FacilityDetail reads the facility id with useParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <FacilityDetail />
    </Suspense>
  );
}
