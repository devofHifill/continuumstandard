"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { data } from "@/lib/data";
import { useHydrated, useSession } from "@/lib/data/hooks";
import { DEMO_TOOLS_ENABLED, demoSignIn, listDemoAccounts } from "@/lib/data/mock/demo";
import { endSession } from "@/components/shell/AuthGate";
import { ROLE_LABEL, roleHome } from "@/lib/auth/roles";

/**
 * Floating demo toolbar (mock mode only): shows who you are, switches accounts
 * in one click, and resets the demo data. Hidden when NEXT_PUBLIC_DEMO_TOOLS=false.
 */
export function DemoToolbar() {
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!DEMO_TOOLS_ENABLED || !hydrated) return null;
  const accounts = listDemoAccounts().filter((a) => a.status === "ACTIVE");

  async function switchTo(email: string) {
    if (!email) return;
    setBusy(true);
    try {
      const s = await demoSignIn(email);
      router.push(roleHome(s.role));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    await endSession(router, "signed-out", () => data.resetDemoData());
    setBusy(false);
    setConfirmReset(false);
  }

  const signOut = () => endSession(router, "signed-out");

  return (
    <>
      <div
        role="region"
        aria-label="Demo tools"
        className="fixed inset-x-2 bottom-2 z-40 flex items-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2 text-sm shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4"
      >
        <span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">DEMO</span>
        <label className="sr-only" htmlFor="demo-switch">
          Switch account
        </label>
        <select
          id="demo-switch"
          disabled={busy}
          value={session?.email ?? ""}
          onChange={(e) => switchTo(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-sm sm:max-w-[14rem]"
        >
          <option value="">Signed out</option>
          {accounts.map((a) => (
            <option key={a.email} value={a.email}>
              {a.name} · {ROLE_LABEL[a.role]}
              {a.facilityName ? ` · ${a.facilityName}` : ""}
            </option>
          ))}
        </select>
        {session && (
          <Button size="sm" variant="ghost" className="shrink-0" onClick={signOut} disabled={busy}>
            Sign out
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => setConfirmReset(true)}
          disabled={busy}
        >
          Reset
        </Button>
      </div>

      <Modal
        open={confirmReset}
        title="Reset demo data?"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reset} loading={busy}>
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This restores the original sample data in this browser and signs you out. Any learners, assignments or
          progress you created will be removed.
        </p>
      </Modal>
    </>
  );
}
