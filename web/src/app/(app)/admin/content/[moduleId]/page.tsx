import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleEditor } from "@/components/admin/ModuleEditor";

export const metadata: Metadata = { title: "Edit module" };

export default function Page() {
  // ModuleEditor reads the module id with useParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ModuleEditor />
    </Suspense>
  );
}
