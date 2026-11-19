import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Assignments" };

export default function Page() {
  return (
    <>
      <PageHeader title="Assignments" description="Assign training to your learners." />
      <ComingSoon phase="F4" items={["Assign one or more modules to one or more learners", "Assignment list with status"]} />
    </>
  );
}
