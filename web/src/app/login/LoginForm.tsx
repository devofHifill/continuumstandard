"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, FormAlert } from "@/components/shell/AuthCard";
import { Badge, Button, Card, CardBody, Field, PasswordField } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { useHydrated, useSession } from "@/lib/data/hooks";
import { DEMO_TOOLS_ENABLED, demoSignIn, latestEmailTo, listDemoAccounts, type DemoAccount } from "@/lib/data/mock/demo";
import { safeNextPath } from "@/lib/auth/password";
import { canAccess, ROLE_LABEL, roleHome } from "@/lib/auth/roles";
import type { Session } from "@/lib/types";

const REASONS: Record<string, { tone: "info" | "success"; text: string }> = {
  "signed-out": { tone: "success", text: "You've been signed out." },
  ended: {
    tone: "info",
    text: "You were signed out because your account or your facility's access is no longer active.",
  },
  "password-set": { tone: "success", text: "Your password has been updated. Sign in with your new password." },
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const next = safeNextPath(params.get("next"));
  const reason = REASONS[params.get("reason") ?? ""];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  /** After sign-in, go back to the page they wanted — if their role may open it. */
  const destination = (s: Session) => (next && canAccess(s.role, next) ? next : roleHome(s.role));

  // Signed in (just now, or already)? Leave the form. This one effect handles both, so
  // it also works when Next.js restores this page with old state (it keeps visited pages
  // mounted in a hidden <Activity>, so "loading" from an earlier sign-in can still be set).
  useEffect(() => {
    if (session) router.replace(destination(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, next]);

  async function run(signIn: () => Promise<Session>) {
    setLoading(true);
    setErrors({});
    try {
      await signIn(); // the effect above redirects once the session exists
    } catch (err) {
      setErrors({ form: err instanceof ServiceError ? err.message : "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);
    void run(() => data.login(email, password));
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access your training and facility tools."
      below={
        DEMO_TOOLS_ENABLED && <DemoAccounts disabled={loading} onPick={(a) => run(() => demoSignIn(a.email))} />
      }
    >
      {reason && !errors.form && <FormAlert tone={reason.tone}>{reason.text}</FormAlert>}
      {errors.form && <FormAlert>{errors.form}</FormAlert>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" size="lg" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-primary underline-offset-2 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </AuthCard>
  );
}

function DemoAccounts({ onPick, disabled }: { onPick: (a: DemoAccount) => void; disabled: boolean }) {
  // Accounts come from browser storage, so read them only after hydration.
  const hydrated = useHydrated();
  if (!hydrated) return null;
  const accounts = listDemoAccounts();
  const groups = new Map<string, DemoAccount[]>();
  for (const a of accounts) {
    const key = a.facilityName ?? "Platform";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return (
    <Card className="border-dashed">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold">Demo accounts</h2>
          <p className="text-sm text-muted">Mock data only. Pick an account to sign in as that user.</p>
        </div>
        {[...groups].map(([group, list]) => (
          <div key={group} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{group}</h3>
            <ul className="flex flex-col">
              {list.map((a) => {
                const invite = a.status === "INVITED" ? latestEmailTo(a.email) : undefined;
                return (
                  <li key={a.email} className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(a)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="block truncate text-muted">{a.email}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {a.status !== "ACTIVE" && <Badge tone="warning">{a.status.toLowerCase()}</Badge>}
                        <Badge tone="primary">{ROLE_LABEL[a.role]}</Badge>
                      </span>
                    </button>
                    {invite && (
                      <Link href={invite.link} className="shrink-0 text-xs font-medium text-primary underline">
                        Open invite
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
