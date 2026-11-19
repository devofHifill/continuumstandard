import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordForm } from "@/components/shell/SetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  // The form reads ?token= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <SetPasswordForm purpose="RESET" />
    </Suspense>
  );
}
