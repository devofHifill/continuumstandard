import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordForm } from "@/components/shell/SetPasswordForm";

export const metadata: Metadata = { title: "Set up your account" };

export default function Page() {
  // The form reads ?token= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <SetPasswordForm purpose="INVITE" />
    </Suspense>
  );
}
