"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, LoadError } from "@/components/learner/parts";
import { DemoInviteLink } from "@/components/facility/LearnerActions";
import { FilterBar, matches, SearchInput, Select, UserStatusBadge } from "@/components/facility/parts";
import { Button, Card, Field, Modal, Table, Td, Th } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { User } from "@/lib/types";
import { useNewParam } from "./useNewParam";

type Action = "deactivate" | "reactivate" | "resend" | "reset";

/** Facility Admins (F5.3, D11): create, edit, deactivate, resend invite, reset access. */
export function AdminsPage() {
  const admins = useQuery("facility-admins", () => data.listFacilityAdmins());
  const facilities = useQuery("facility-rows", () => data.listFacilityRows());
  const [search, setSearch] = useState("");
  const [facilityId, setFacilityId] = useState("ALL");
  const [creating, setCreating] = useNewParam("/admin/facility-admins");
  const [editing, setEditing] = useState<User | null>(null);
  const [pending, setPending] = useState<{ user: User; action: Action } | null>(null);
  const [notice, setNotice] = useState<{ text: string; email?: string } | null>(null);

  const rows = (admins.data ?? []).filter(
    (r) => (facilityId === "ALL" || r.user.facilityId === facilityId) && matches(search, r.user.name, r.user.email),
  );
  const facilityOptions = (facilities.data ?? []).map((f) => ({ value: f.facility.id, label: f.facility.name }));

  return (
    <>
      <PageHeader
        title="Facility Admins"
        description="People who manage each facility's learners and training. A facility can have several."
        actions={<Button onClick={() => setCreating(true)}>Add Facility Admin</Button>}
      />
      {notice && (
        <div className="mb-4">
          <FormAlert tone="success">
            {notice.text} {notice.email && <DemoInviteLink email={notice.email} />}
          </FormAlert>
        </div>
      )}
      <FilterBar>
        <SearchInput label="Search" placeholder="Name or email" value={search} onChange={setSearch} />
        <Select label="Facility" value={facilityId} onChange={setFacilityId} options={[{ value: "ALL", label: "All facilities" }, ...facilityOptions]} />
      </FilterBar>

      {admins.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {admins.status === "error" && <LoadError message={admins.error.message} />}
      {admins.status === "success" &&
        (rows.length === 0 ? (
          <EmptyState title="No Facility Admins match" />
        ) : (
          <Card>
            <Table>
              <caption className="sr-only">Facility Admins</caption>
              <thead>
                <tr>
                  <Th>Admin</Th>
                  <Th>Facility</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id} className={r.user.status === "DEACTIVATED" ? "text-muted" : undefined}>
                    <Td>
                      <span className="font-medium text-foreground">{r.user.name}</span>
                      <div className="text-xs text-muted">
                        {r.user.email}
                        {r.user.jobTitle && ` · ${r.user.jobTitle}`}
                      </div>
                    </Td>
                    <Td>
                      {r.facilityName}
                      {!r.facilityActive && <div className="text-xs text-muted">Facility inactive</div>}
                    </Td>
                    <Td>
                      <UserStatusBadge status={r.user.status} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r.user)}>
                          Edit
                        </Button>
                        {r.user.status === "INVITED" && (
                          <Button size="sm" variant="secondary" onClick={() => setPending({ user: r.user, action: "resend" })}>
                            Resend invite
                          </Button>
                        )}
                        {r.user.status === "ACTIVE" && (
                          <Button size="sm" variant="secondary" onClick={() => setPending({ user: r.user, action: "reset" })}>
                            Reset access
                          </Button>
                        )}
                        {r.user.status === "DEACTIVATED" ? (
                          <Button size="sm" variant="secondary" onClick={() => setPending({ user: r.user, action: "reactivate" })}>
                            Reactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setPending({ user: r.user, action: "deactivate" })}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}

      <Modal open={creating || !!editing} title={editing ? "Edit Facility Admin" : "Add Facility Admin"} onClose={() => (editing ? setEditing(null) : setCreating(false))}>
        {(creating || editing) && (
          <AdminForm
            key={editing?.id ?? "new"}
            admin={editing ?? undefined}
            facilities={facilityOptions}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={(u, created) => {
              setCreating(false);
              setEditing(null);
              setNotice(created ? { text: `${u.name} was added and invited by email.`, email: u.email } : { text: `${u.name}'s details were saved.` });
            }}
          />
        )}
      </Modal>
      <ConfirmAction
        pending={pending}
        onClose={() => setPending(null)}
        onDone={(text, email) => {
          setPending(null);
          setNotice({ text, email });
        }}
      />
    </>
  );
}

function AdminForm({
  admin,
  facilities,
  onClose,
  onSaved,
}: {
  admin?: User;
  facilities: { value: string; label: string }[];
  onClose: () => void;
  onSaved: (u: User, created: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: admin?.name ?? "",
    email: admin?.email ?? "",
    jobTitle: admin?.jobTitle ?? "",
    facilityId: admin?.facilityId ?? facilities[0]?.value ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const u = admin
        ? await data.updateFacilityAdmin(admin.id, { name: form.name, email: form.email, jobTitle: form.jobTitle })
        : await data.createFacilityAdmin(form);
      onSaved(u, !admin);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      {admin ? (
        <p className="text-sm text-muted">Facility: {facilities.find((f) => f.value === admin.facilityId)?.label}</p>
      ) : (
        <Select label="Facility" value={form.facilityId} onChange={(v) => setForm((f) => ({ ...f, facilityId: v }))} options={facilities} />
      )}
      <Field label="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
      <Field
        label="Work email"
        type="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        hint={admin ? undefined : "We'll email an invite to set a password."}
      />
      <Field label="Job title (optional)" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {admin ? "Save changes" : "Add and send invite"}
        </Button>
      </div>
    </form>
  );
}

const COPY: Record<Action, { title: (n: string) => string; body: (u: User) => string; button: string; done: (u: User) => string }> = {
  deactivate: {
    title: (n) => `Deactivate ${n}?`,
    body: () => "They'll be signed out and won't be able to sign in. Nothing they did is deleted.",
    button: "Deactivate",
    done: (u) => `${u.name} has been deactivated.`,
  },
  reactivate: {
    title: (n) => `Reactivate ${n}?`,
    body: () => "They'll be able to sign in again.",
    button: "Reactivate",
    done: (u) => `${u.name} has been reactivated.`,
  },
  resend: {
    title: (n) => `Resend invite to ${n}?`,
    body: (u) => `A new set-password link will be emailed to ${u.email}. Earlier links stop working.`,
    button: "Send invite",
    done: (u) => `A new invite was sent to ${u.email}.`,
  },
  reset: {
    title: (n) => `Reset access for ${n}?`,
    body: (u) => `A password-reset link (valid for 60 minutes) will be emailed to ${u.email}. Their current password keeps working until they use it.`,
    button: "Send reset link",
    done: (u) => `A password-reset link was sent to ${u.email}.`,
  },
};

function ConfirmAction({
  pending,
  onClose,
  onDone,
}: {
  pending: { user: User; action: Action } | null;
  onClose: () => void;
  onDone: (text: string, email?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = pending ? COPY[pending.action] : null;

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const { user, action } = pending;
      if (action === "resend") await data.resendAdminInvite(user.id);
      else if (action === "reset") await data.sendAdminPasswordReset(user.id);
      else await data.setAdminActive(user.id, action === "reactivate");
      onDone(COPY[action].done(user), action === "resend" || action === "reset" ? user.email : undefined);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!pending}
      title={pending && copy ? copy.title(pending.user.name) : ""}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={pending?.action === "deactivate" ? "danger" : "primary"} loading={busy} onClick={confirm}>
            {copy?.button}
          </Button>
        </>
      }
    >
      {pending && copy && <p className="text-sm">{copy.body(pending.user)}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
