import type { Metadata } from "next";
import { RoleDashboard } from "@/components/shell/RoleDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <RoleDashboard phase="F4" items={["Facility summary: learners, assigned modules, completion", "Quick actions: add learner, assign training, view progress"]} />;
}
