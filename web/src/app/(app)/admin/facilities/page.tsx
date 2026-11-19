import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Facilities" };

export default function Page() {
  return (
    <>
      <PageHeader title="Facilities" description="Create, edit and activate or deactivate facilities." />
      <ComingSoon phase="F5" items={["Facility list with search and status", "Create / edit facility, activate or deactivate"]} />
    </>
  );
}
