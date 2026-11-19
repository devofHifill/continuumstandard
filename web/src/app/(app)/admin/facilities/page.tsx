import type { Metadata } from "next";
import { Suspense } from "react";
import { FacilitiesPage } from "@/components/admin/FacilitiesPage";

export const metadata: Metadata = { title: "Facilities" };

export default function Page() {
  // FacilitiesPage reads ?new=1 with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <FacilitiesPage />
    </Suspense>
  );
}
