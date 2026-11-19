import type { Metadata } from "next";
import { DashboardPreview } from "./DashboardPreview";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-28">
      <DashboardPreview />
    </main>
  );
}
