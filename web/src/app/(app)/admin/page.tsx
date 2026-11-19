import type { Metadata } from "next";
import { RoleDashboard } from "@/components/shell/RoleDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <RoleDashboard phase="F5" items={["Summary cards: facilities, active learners, modules, activity", "Facility directory and quick actions"]} />;
}
