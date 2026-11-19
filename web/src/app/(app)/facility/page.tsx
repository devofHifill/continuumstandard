import type { Metadata } from "next";
import { FacilityDashboard } from "@/components/facility/FacilityDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <FacilityDashboard />;
}
