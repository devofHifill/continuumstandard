import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "My Progress" };

export default function Page() {
  return (
    <>
      <PageHeader title="My Progress" description="Your completed and in-progress training." />
      <ComingSoon phase="F3" items={["Completed and in-progress modules", "Your knowledge-check results"]} />
    </>
  );
}
