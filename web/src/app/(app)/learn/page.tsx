import type { Metadata } from "next";
import { RoleDashboard } from "@/components/shell/RoleDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <RoleDashboard phase="F3" items={["Your assigned training with status and Start/Continue", "Recent activity and results"]} />;
}
