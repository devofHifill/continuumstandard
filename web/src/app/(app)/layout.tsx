import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { AuthGate } from "@/components/shell/AuthGate";

/**
 * Every signed-in page: guard first, then the role's shell and navigation.
 * AuthGate and AppShell read the URL (usePathname), which can't be known while
 * prerendering dynamic routes like /learn/training/[moduleId] — hence the Suspense boundary.
 */
export default function SignedInLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<GateFallback />}>
      <AuthGate>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </Suspense>
  );
}

function GateFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-8" role="status">
      <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
