import type { Metadata } from "next";
import { Suspense } from "react";
import { KnowledgeCheck } from "@/components/learner/KnowledgeCheck";

export const metadata: Metadata = { title: "Knowledge check" };

export default function Page() {
  // KnowledgeCheck reads the module id with useParams, which needs a Suspense boundary for dynamic routes.
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <KnowledgeCheck />
    </Suspense>
  );
}
