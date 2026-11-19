import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminsPage } from "@/components/admin/AdminsPage";

export const metadata: Metadata = { title: "Facility Admins" };

export default function Page() {
  // AdminsPage reads ?new=1 with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <AdminsPage />
    </Suspense>
  );
}
