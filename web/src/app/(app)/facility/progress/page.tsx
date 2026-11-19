import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Learner Progress" };

export default function Page() {
  return (
    <>
      <PageHeader title="Learner Progress" description="Training status and results for your facility." />
      <ComingSoon phase="F4" items={["Not started / in progress / completed by learner and module", "Assessment results and decision-point responses"]} />
    </>
  );
}
