import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return (
    <>
      <PageHeader title="Activity" description="Basic platform activity." />
      <ComingSoon phase="F5" items={["Recent facility, learner and training activity"]} />
    </>
  );
}
