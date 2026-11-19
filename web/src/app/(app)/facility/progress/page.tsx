import type { Metadata } from "next";
import { ProgressPage } from "@/components/facility/ProgressPage";

export const metadata: Metadata = { title: "Learner Progress" };

export default function Page() {
  return <ProgressPage />;
}
