import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon, PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Assigned Training" };

export default function Page() {
  return (
    <>
      <PageHeader title="Assigned Training" description="Modules assigned to you." />
      <div className="flex flex-col gap-4">
        <ComingSoon
          phase="F3"
          items={["Training cards with status and Start / Continue", "Module intro, scenario player and knowledge check"]}
        />
        <p className="text-sm">
          Want to try the scenario player now?{" "}
          <Link href="/poc" className="font-medium text-primary underline">
            Open the video engine proof of concept
          </Link>
        </p>
      </div>
    </>
  );
}
