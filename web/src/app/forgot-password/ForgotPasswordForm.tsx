"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, FormAlert } from "@/components/shell/AuthCard";
import { Button, Field } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { DEMO_TOOLS_ENABLED, latestEmailTo } from "@/lib/data/mock/demo";
import { useResetOnHide } from "@/lib/useResetOnHide";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useResetOnHide(() => {
    setSentTo(null);
    setLoading(false);
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setError(undefined);
    setFormError(undefined);
    setLoading(true);
    try {
      await data.requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (err) {
      setFormError(err instanceof ServiceError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    // Same message whether or not the account exists — attackers can't use this page to find emails.
    const demoMail = DEMO_TOOLS_ENABLED ? latestEmailTo(sentTo) : undefined;
    const isResetMail = demoMail?.link.startsWith("/reset-password");
    return (
      <AuthCard title="Check your email">
        <p className="text-sm">
          If <strong>{sentTo}</strong> belongs to an active account, we&apos;ve sent a link to reset the password. The
          link works once and expires in 60 minutes.
        </p>
        {DEMO_TOOLS_ENABLED && (
          <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm">
            <p className="font-semibold">Demo inbox</p>
            {isResetMail ? (
              <p className="mt-1">
                <Link href={demoMail!.link} className="font-medium text-primary underline">
                  Open the reset link
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-muted">No email was sent (unknown or inactive account).</p>
            )}
          </div>
        )}
        <p className="text-sm">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" description="Enter your work email and we'll send you a reset link.">
      {formError && <FormAlert>{formError}</FormAlert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" size="lg" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
