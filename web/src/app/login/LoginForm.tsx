"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, CardBody, Field } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { DEMO_TOOLS_ENABLED, demoPassword, listDemoAccounts, type DemoAccount } from "@/lib/data/mock/demo";
import { ROLE_LABEL, roleHome } from "@/lib/auth/roles";
import { useHydrated } from "@/lib/data/hooks";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function signIn(emailValue: string, passwordValue: string) {
    setLoading(true);
    setErrors({});
    try {
      const session = await data.login(emailValue, passwordValue);
      router.push(roleHome(session.role));
    } catch (err) {
      setErrors({ form: err instanceof ServiceError ? err.message : "Something went wrong. Please try again." });
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    if (Object.keys(next).length) return setErrors(next);
    void signIn(email, password);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-5 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Access your training and facility tools.</p>
          </div>

          {errors.form && (
            <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.form}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <Button type="submit" size="lg" loading={loading}>
              Sign in
            </Button>
          </form>
          <p className="text-center text-sm text-muted">Forgot password? (coming in F2)</p>
        </CardBody>
      </Card>

      {DEMO_TOOLS_ENABLED && <DemoAccounts disabled={loading} onPick={(a) => signIn(a.email, demoPassword)} />}
    </div>
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
              {list.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(a)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
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
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
