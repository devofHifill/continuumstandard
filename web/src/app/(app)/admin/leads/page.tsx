import type { Metadata } from "next";
import { LeadsPage } from "@/components/admin/LeadsPage";

export const metadata: Metadata = { title: "Demo Requests" };

export default function Page() {
  return <LeadsPage />;
}
