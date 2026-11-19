import type { Metadata } from "next";
import { MyProgress } from "@/components/learner/MyProgress";

export const metadata: Metadata = { title: "My Progress" };

export default function Page() {
  return <MyProgress />;
}
