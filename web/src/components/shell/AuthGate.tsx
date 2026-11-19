"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { data } from "@/lib/data";
import { useSession } from "@/lib/data/hooks";
import { canAccess, roleHome } from "@/lib/auth/roles";

type Router = ReturnType<typeof useRouter>;
export type SignOutReason = "signed-out" | "ended";

/** Set while we're signing out on purpose, so the guard doesn't race us to /login?next=… */
let leaving = false;

/**
 * Sign out and land on the login page with a reason it can explain.
 * `signOut` can be swapped (the demo Reset clears the session itself).
 */
export async function endSession(router: Router, reason: SignOutReason, signOut = () => data.logout()) {
  leaving = true;
  await signOut();
  router.replace(`/login?reason=${reason}`);
}

/**
 * Route guard for every signed-in page (F2.6).
 *
 *   signed out            → /login?next=<this page>
 *   wrong role for route  → that role's own home
 *   account/facility no longer active (re-checked with the "server" on each navigation)
 *                         → signed out, /login?reason=ended  (F2.7)
 *
 * ⚠ This is user experience, not security: anyone can edit browser code. The real API
 * must reject the same requests on the server (see the mock's requireSession/inScope).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (session === null) {
      if (!leaving) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (session) {
      leaving = false;
      if (!canAccess(session.role, pathname)) router.replace(roleHome(session.role));
    }
  }, [session, pathname, router]);

  // Re-validate on every navigation and whenever data changes (also in other tabs),
  // so a user who is deactivated mid-session is signed out promptly.
  const userId = session?.userId;
  useEffect(() => {
    if (!userId) return;
    const check = () => void data.refreshSession().catch(() => endSession(router, "ended"));
    check();
    return data.subscribe(check);
  }, [userId, pathname, router]);

  if (!session || !canAccess(session.role, pathname)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8" role="status">
        <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  return <>{children}</>;
}
