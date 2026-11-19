import type { Metadata } from "next";
import { LearnerDashboard } from "@/components/learner/LearnerDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <LearnerDashboard />;
}
