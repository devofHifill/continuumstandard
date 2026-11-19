"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, formatDate, LoadError } from "@/components/learner/parts";
import { Button, Card, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { User, UserStatus } from "@/lib/types";
import { DemoInviteLink, LearnerActionButtons, useLearnerActions } from "./LearnerActions";
import { LearnerFormModal } from "./LearnerFormModal";
import { FilterBar, learnerHref, matches, SearchInput, Select, UserStatusBadge } from "./parts";

type StatusFilter = "ALL" | UserStatus;

/** Learner roster (F4.2) with add / edit / deactivate (F4.3). */
export function LearnersPage() {
  const q = useQuery("facility-learners", () => data.listFacilityLearners());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const params = useSearchParams();
  const router = useRouter();
  // ?new=1 (the dashboard's "Add learner" button) opens the form straight away.
  const [editing, setEditingState] = useState<User | "new" | null>(params.get("new") ? "new" : null);
  // Also when the page is restored (Next keeps it mounted) and the link is used again.
  const newParam = params.get("new");
  const [seenNew, setSeenNew] = useState(newParam);
  if (newParam !== seenNew) {
    setSeenNew(newParam);
    if (newParam) setEditingState("new");
  }
  const setEditing = (v: User | "new" | null) => {
    setEditingState(v);
    if (v === null && params.get("new")) router.replace("/facility/learners");
  };
  const [notice, setNotice] = useState<{ text: string; email?: string } | null>(null);
  const actions = useLearnerActions((text) => setNotice({ text }));

  const rows = (q.data ?? []).filter(
    (r) => (status === "ALL" || r.user.status === status) && matches(search, r.user.name, r.user.email, r.user.jobTitle),
  );

  return (
    <>
      <PageHeader
        title="Learners"
        description="Staff in your facility who take training."
        actions={<Button onClick={() => setEditing("new")}>Add learner</Button>}
      />

      {notice && (
        <div className="mb-4">
          <FormAlert tone="success">
            {notice.text} {notice.email && <DemoInviteLink email={notice.email} />}
          </FormAlert>
        </div>
      )}

      <FilterBar>
        <SearchInput label="Search" placeholder="Name, email or job title" value={search} onChange={setSearch} />
        <Select<StatusFilter>
          label="Account status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "INVITED", label: "Invited" },
            { value: "DEACTIVATED", label: "Deactivated" },
          ]}
        />
      </FilterBar>

      {q.status === "loading" && <p className="text-sm text-muted">Loading learners…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" &&
        (q.data.length === 0 ? (
          <EmptyState title="No learners yet">Add your first learner to start assigning training.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState title="No learners match">Try a different search or status.</EmptyState>
        ) : (
          <Card>
            <Table>
              <caption className="sr-only">Learners in your facility</caption>
              <thead>
                <tr>
                  <Th>Learner</Th>
                  <Th>Status</Th>
                  <Th>Training</Th>
                  <Th>Last activity</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id} className={r.user.status === "DEACTIVATED" ? "text-muted" : undefined}>
                    <Td>
                      <Link href={learnerHref(r.user.id)} className="font-medium text-foreground hover:underline">
                        {r.user.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {r.user.email}
                        {r.user.jobTitle && ` · ${r.user.jobTitle}`}
                      </div>
                    </Td>
                    <Td>
                      <UserStatusBadge status={r.user.status} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.assigned === 0 ? (
                        <span className="text-muted">None assigned</span>
                      ) : (
                        <>
                          {r.completed}/{r.assigned} completed
                          {r.inProgress > 0 && <span className="text-muted"> · {r.inProgress} in progress</span>}
                        </>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{r.lastActivityAt ? formatDate(r.lastActivityAt) : "—"}</Td>
                    <Td>
                      <LearnerActionButtons user={r.user} onEdit={() => setEditing(r.user)} ask={actions.ask} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}

      <LearnerFormModal
        open={editing !== null}
        learner={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={(user, created) => {
          setEditing(null);
          setNotice(
            created
              ? { text: `${user.name} was added and invited by email.`, email: user.email }
              : { text: `${user.name}'s details were saved.` },
          );
        }}
      />
      {actions.dialog}
    </>
  );
}
