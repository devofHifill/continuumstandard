import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Demo Requests" };

export default function Page() {
  return (
    <>
      <PageHeader title="Demo Requests" description="Requests submitted from the public website." />
      <ComingSoon phase="F5" items={["List of demo requests (pending client confirmation, decision D9)"]} />
    </>
  );
}
