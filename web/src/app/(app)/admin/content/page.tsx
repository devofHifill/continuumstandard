import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Training Content" };

export default function Page() {
  return (
    <>
      <PageHeader title="Training Content" description="Modules, videos, decision points and knowledge checks." />
      <ComingSoon phase="F5" items={["Module list with draft / active status", "Module, decision-point and knowledge-check editors"]} />
    </>
  );
}
