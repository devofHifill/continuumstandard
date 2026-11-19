"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, formatDate, LoadError } from "@/components/learner/parts";
import { FilterBar, matches, SearchInput } from "@/components/facility/parts";
import { Badge, Button, Card, Field, Modal, Table, Td, Th } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { Facility } from "@/lib/types";
import { useNewParam } from "./useNewParam";

/** Facilities (F5.2): list, create, edit, activate/deactivate. */
export function FacilitiesPage() {
  const q = useQuery("facility-rows", () => data.listFacilityRows());
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useNewParam("/admin/facilities");
  const [editing, setEditing] = useState<Facility | null>(null);
  const [toggling, setToggling] = useState<Facility | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = (q.data ?? []).filter((r) => matches(search, r.facility.name, r.facility.contactName, r.facility.contactEmail));

  return (
    <>
      <PageHeader
        title="Facilities"
        description="Each facility is a separate customer: its admins and learners only see their own records."
        actions={<Button onClick={() => setCreating(true)}>Create facility</Button>}
      />
      {notice && (
        <div className="mb-4">
          <FormAlert tone="success">{notice}</FormAlert>
        </div>
      )}
      <FilterBar>
        <SearchInput label="Search" placeholder="Facility or contact" value={search} onChange={setSearch} />
      </FilterBar>

      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" &&
        (rows.length === 0 ? (
          <EmptyState title={q.data.length ? "No facilities match" : "No facilities yet"} />
        ) : (
          <Card>
            <Table>
              <caption className="sr-only">Facilities</caption>
              <thead>
                <tr>
                  <Th>Facility</Th>
                  <Th>Contact</Th>
                  <Th>Admins</Th>
                  <Th>Learners</Th>
                  <Th>Completion</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.facility.id} className={r.facility.isActive ? undefined : "text-muted"}>
                    <Td>
                      <Link href={`/admin/facilities/${r.facility.id}`} className="font-medium text-foreground hover:underline">
                        {r.facility.name}
                      </Link>
                      <div className="text-xs text-muted">Since {formatDate(r.facility.createdAt)}</div>
                    </Td>
                    <Td>
                      {r.facility.contactName}
                      <div className="text-xs text-muted">{r.facility.contactEmail}</div>
                    </Td>
                    <Td>{r.admins}</Td>
                    <Td>{r.learners}</Td>
                    <Td>{r.assignments ? `${r.completionPercent}%` : "—"}</Td>
                    <Td>
                      <Badge tone={r.facility.isActive ? "success" : "neutral"}>{r.facility.isActive ? "Active" : "Inactive"}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r.facility)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={r.facility.isActive ? "text-danger" : undefined}
                          onClick={() => setToggling(r.facility)}
                        >
                          {r.facility.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}

      <FacilityFormModal
        open={creating || !!editing}
        facility={editing ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(f, created) => {
          setCreating(false);
          setEditing(null);
          setNotice(created ? `${f.name} was created. Next, add a Facility Admin for it.` : `${f.name} was updated.`);
        }}
      />
      <ToggleFacility facility={toggling} onClose={() => setToggling(null)} onDone={(m) => (setToggling(null), setNotice(m))} />
    </>
  );
}

export function FacilityFormModal({
  open,
  facility,
  onClose,
  onSaved,
}: {
  open: boolean;
  facility?: Facility;
  onClose: () => void;
  onSaved: (f: Facility, created: boolean) => void;
}) {
  return (
    <Modal open={open} title={facility ? "Edit facility" : "Create facility"} onClose={onClose}>
      {open && <FacilityForm key={facility?.id ?? "new"} facility={facility} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FacilityForm({ facility, onClose, onSaved }: { facility?: Facility; onClose: () => void; onSaved: (f: Facility, created: boolean) => void }) {
  const [form, setForm] = useState({
    name: facility?.name ?? "",
    contactName: facility?.contactName ?? "",
    contactEmail: facility?.contactEmail ?? "",
    phone: facility?.phone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const f = facility ? await data.updateFacility(facility.id, form) : await data.createFacility(form);
      onSaved(f, !facility);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't save the facility.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="Facility name" value={form.name} onChange={set("name")} autoFocus />
      <Field label="Contact name" value={form.contactName} onChange={set("contactName")} />
      <Field label="Contact email" type="email" value={form.contactEmail} onChange={set("contactEmail")} />
      <Field label="Phone (optional)" type="tel" value={form.phone} onChange={set("phone")} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {facility ? "Save changes" : "Create facility"}
        </Button>
      </div>
    </form>
  );
}

function ToggleFacility({ facility, onClose, onDone }: { facility: Facility | null; onClose: () => void; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const off = facility?.isActive;
  async function confirm() {
    if (!facility) return;
    setBusy(true);
    setError(null);
    try {
      await data.setFacilityActive(facility.id, !facility.isActive);
      onDone(`${facility.name} has been ${off ? "deactivated" : "reactivated"}.`);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!facility}
      title={`${off ? "Deactivate" : "Reactivate"} ${facility?.name ?? ""}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={off ? "danger" : "primary"} loading={busy} onClick={confirm}>
            {off ? "Deactivate" : "Reactivate"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {off
          ? "Everyone at this facility — admins and learners — will be signed out and unable to sign in. Nothing is deleted, and you can reactivate it at any time."
          : "Its admins and learners will be able to sign in again."}
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
