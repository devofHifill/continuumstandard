import type { Metadata } from "next";
import { TrainingList } from "@/components/learner/TrainingList";

export const metadata: Metadata = { title: "Assigned Training" };

export default function Page() {
  return <TrainingList />;
}
