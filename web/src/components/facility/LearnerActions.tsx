"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { DEMO_TOOLS_ENABLED, latestEmailTo } from "@/lib/data/mock/demo";
import type { User } from "@/lib/types";
import Link from "next/link";

/**
 * Deactivate / reactivate / resend invite for one learner, each with a confirmation.
 * `onDone` receives a message to show the admin.
 */
export function useLearnerActions(onDone: (message: string) => void) {
  const [target, setTarget] = useState<{ user: User; action: "deactivate" | "reactivate" | "resend" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const { user, action } = target;
      if (action === "resend") await data.resendInvite(user.id);
      else await data.setLearnerActive(user.id, action === "reactivate");
      onDone(
        action === "resend"
          ? `A new invite was sent to ${user.email}.`
          : `${user.name} has been ${action === "reactivate" ? "reactivated" : "deactivated"}.`,
      );
      setTarget(null);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const copy = target && {
    deactivate: {
      title: `Deactivate ${target.user.name}?`,
      body: "They won't be able to sign in or be assigned training. Their training history is kept, and you can reactivate them at any time.",
      button: "Deactivate",
    },
    reactivate: {
      title: `Reactivate ${target.user.name}?`,
      body: "They'll be able to sign in again and continue their training.",
      button: "Reactivate",
    },
    resend: {
      title: `Resend invite to ${target.user.name}?`,
      body: `A new set-password link will be emailed to ${target.user.email}. Any earlier link stops working.`,
      button: "Send invite",
    },
  }[target.action];

  const dialog = (
    <Modal
      open={!!target}
      title={copy?.title ?? ""}
      onClose={() => setTarget(null)}
      footer={
        <>
          <Button variant="secondary" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button variant={target?.action === "deactivate" ? "danger" : "primary"} onClick={confirm} loading={busy}>
            {copy?.button}
          </Button>
        </>
      }
    >
      <p className="text-sm">{copy?.body}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );

  return { ask: (user: User, action: "deactivate" | "reactivate" | "resend") => setTarget({ user, action }), dialog };
}

/** The action buttons that fit a learner's current status. */
export function LearnerActionButtons({
  user,
  onEdit,
  ask,
}: {
  user: User;
  onEdit: () => void;
  ask: (user: User, action: "deactivate" | "reactivate" | "resend") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={onEdit}>
        Edit
      </Button>
      {user.status === "INVITED" && (
        <Button size="sm" variant="secondary" onClick={() => ask(user, "resend")}>
          Resend invite
        </Button>
      )}
      {user.status === "DEACTIVATED" ? (
        <Button size="sm" variant="secondary" onClick={() => ask(user, "reactivate")}>
          Reactivate
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => ask(user, "deactivate")}>
          Deactivate
        </Button>
      )}
    </div>
  );
}

/** Demo mode: show the latest invite/reset "email" link so the flow can be tried without a mail server. */
export function DemoInviteLink({ email }: { email: string }) {
  if (!DEMO_TOOLS_ENABLED) return null;
  const mail = latestEmailTo(email);
  const kind = mail?.link.startsWith("/set-password") ? "invite" : mail?.link.startsWith("/reset-password") ? "reset" : null;
  if (!mail || !kind) return null;
  return (
    <span className="text-xs">
      Demo inbox:{" "}
      <Link href={mail.link} className="font-medium text-primary underline">
        open {kind} link
      </Link>{" "}
      (sign out first)
    </span>
  );
}
