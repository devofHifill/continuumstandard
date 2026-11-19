"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, PasswordField } from "@/components/ui";
import { data, ServiceError, type AuthTokenPurpose } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import { PASSWORD_HINT, validatePassword } from "@/lib/auth/password";
import { roleHome } from "@/lib/auth/roles";
import { useResetOnHide } from "@/lib/useResetOnHide";
import { AuthCard, FormAlert } from "./AuthCard";

const COPY: Record<AuthTokenPurpose, { title: string; button: string }> = {
  INVITE: { title: "Set up your account", button: "Create password and sign in" },
  RESET: { title: "Choose a new password", button: "Save password and sign in" },
};

/**
 * Shared by /set-password (invite, decision D8) and /reset-password (forgot password).
 * The link's token is checked first, so an expired or used link shows a clear message
 * instead of a form that can only fail.
 */
export function SetPasswordForm({ purpose }: { purpose: AuthTokenPurpose }) {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const copy = COPY[purpose];

  const check = useQuery(`token:${purpose}:${token}`, () => data.checkAuthToken(token, purpose));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  useResetOnHide(() => {
    setLoading(false);
    setPassword("");
    setConfirm("");
    setErrors({});
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const problem = validatePassword(password);
    if (problem) next.password = problem;
    if (!next.password && confirm !== password) next.confirm = "The passwords don't match.";
    if (Object.keys(next).length) return setErrors(next);
    setErrors({});
    setLoading(true);
    try {
      const session = await data.completeAuthToken(token, purpose, password);
      router.replace(roleHome(session.role));
    } catch (err) {
      setErrors({ form: err instanceof ServiceError ? err.message : "Something went wrong. Please try again." });
      setLoading(false);
    }
  }

  const info = check.status === "success" ? check.data : null;

  if (check.status === "loading" || (check.status === "error" && loading)) {
    return (
      <AuthCard title={copy.title}>
        <p className="text-sm text-muted">Checking your link…</p>
      </AuthCard>
    );
  }

  // `!loading`: once submitted, the link is (correctly) used up — don't flash "already used" while redirecting.
  if (check.status === "error" && !loading) {
    return (
      <AuthCard title="This link can't be used">
        <FormAlert>{check.error.message}</FormAlert>
        <p className="text-sm">
          {purpose === "RESET" ? (
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Request a new reset link
            </Link>
          ) : (
            "Ask your administrator to send you a new invite."
          )}
        </p>
        <p className="text-sm">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (!info) return null;

  return (
    <AuthCard
      title={copy.title}
      description={
        <>
          {purpose === "INVITE" ? "Welcome, " : "For "}
          <strong>{info.name}</strong> ({info.email})
        </>
      }
    >
      {errors.form && <FormAlert>{errors.form}</FormAlert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {/* Hidden username helps password managers save the right account. */}
        <input type="email" autoComplete="username" value={info.email} readOnly hidden />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={PASSWORD_HINT}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <Button type="submit" size="lg" loading={loading}>
          {copy.button}
        </Button>
      </form>
    </AuthCard>
  );
}
