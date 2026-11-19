"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { endSession } from "@/components/shell/AuthGate";
import { FormAlert } from "@/components/shell/AuthCard";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, Card, CardBody, CardHeader, Field, PasswordField } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { useQuery, useSession } from "@/lib/data/hooks";
import { PASSWORD_HINT, validatePassword } from "@/lib/auth/password";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { Session, User } from "@/lib/types";
import { useResetOnHide } from "@/lib/useResetOnHide";

export function ProfileClient() {
  const session = useSession();
  const router = useRouter();
  if (!session) return null;
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details."
        actions={
          <Button variant="secondary" onClick={() => endSession(router, "signed-out")}>
            Sign out
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DetailsCard session={session} />
        <PasswordCard />
      </div>
    </>
  );
}

function DetailsCard({ session }: { session: Session }) {
  const user = useQuery(`me:${session.userId}`, () => data.getUser(session.userId));
  const facility = useQuery(`facility:${session.facilityId}`, () =>
    session.facilityId ? data.getFacility(session.facilityId) : Promise.resolve(null),
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Details</h2>
      </CardHeader>
      <CardBody>
        {user.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
        {user.status === "error" && <FormAlert>{user.error.message}</FormAlert>}
        {user.status === "success" && (
          <DetailsForm
            key={user.data.id}
            user={user.data}
            facilityName={facility.data?.name ?? null}
          />
        )}
      </CardBody>
    </Card>
  );
}

function DetailsForm({ user, facilityName }: { user: User; facilityName: string | null }) {
  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = name !== user.name || jobTitle !== (user.jobTitle ?? "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name.");
    setError(undefined);
    setStatus("saving");
    try {
      await data.updateMyProfile({ name, jobTitle });
      setStatus("saved");
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't save your changes.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {status === "saved" && !dirty && <FormAlert tone="success">Your details have been saved.</FormAlert>}
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} autoComplete="name" />
      <Field
        label="Job title"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        autoComplete="organization-title"
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-muted">Role</dt>
        <dd>{ROLE_LABEL[user.role]}</dd>
        {facilityName && (
          <>
            <dt className="text-muted">Facility</dt>
            <dd>{facilityName}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted">To change your email, ask your administrator.</p>
      <div>
        <Button type="submit" disabled={!dirty} loading={status === "saving"}>
          Save details
        </Button>
      </div>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Never leave passwords sitting in a hidden page.
  useResetOnHide(() => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    setDone(false);
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v: typeof errors = {};
    if (!current) v.current = "Enter your current password.";
    const problem = validatePassword(next);
    if (problem) v.next = problem;
    if (!v.next && confirm !== next) v.confirm = "The passwords don't match.";
    if (Object.keys(v).length) return setErrors(v);
    setErrors({});
    setLoading(true);
    try {
      await data.changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setErrors({ form: err instanceof ServiceError ? err.message : "Couldn't change your password." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Change password</h2>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {done && <FormAlert tone="success">Your password has been changed.</FormAlert>}
          {errors.form && <FormAlert>{errors.form}</FormAlert>}
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => {
              setDone(false);
              setCurrent(e.target.value);
            }}
            error={errors.current}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={errors.next}
            hint={PASSWORD_HINT}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
          <div>
            <Button type="submit" loading={loading}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
