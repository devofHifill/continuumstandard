import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Facility Admins" };

export default function Page() {
  return (
    <>
      <PageHeader title="Facility Admins" description="Accounts that manage each facility." />
      <ComingSoon phase="F5" items={["Create and edit Facility Admin accounts", "Resend invite / reset access"]} />
    </>
  );
}
