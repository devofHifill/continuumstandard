import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Learners" };

export default function Page() {
  return (
    <>
      <PageHeader title="Learners" description="Staff in your facility." />
      <ComingSoon phase="F4" items={["Learner roster with search and filters", "Add, edit and deactivate learners (sends an invite)"]} />
    </>
  );
}
