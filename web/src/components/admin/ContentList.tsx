"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, formatDate, LoadError } from "@/components/learner/parts";
import { FilterBar, matches, SearchInput, Select } from "@/components/facility/parts";
import { Badge, Button, Card, Modal, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { ModuleStatus } from "@/lib/types";
import { DetailsForm, emptyDetails } from "./editor/DetailsForm";
import { ModuleStatusBadge } from "./editor/ModuleStatusBadge";

/** Training content (F5.4): every module with its status and readiness. */
export function ContentList() {
  const q = useQuery("module-rows", () => data.listModuleRows());
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ModuleStatus>("ALL");
  const [creating, setCreating] = useState(false);

  const rows = (q.data ?? []).filter(
    (r) => (status === "ALL" || r.module.status === status) && matches(search, r.module.title, r.module.category),
  );

  return (
    <>
      <PageHeader
        title="Training Content"
        description="Modules, scenario videos, decision points and knowledge checks. Content is data — edit it here, no developer needed."
        actions={<Button onClick={() => setCreating(true)}>New module</Button>}
      />
      <FilterBar>
        <SearchInput label="Search" placeholder="Title or category" value={search} onChange={setSearch} />
        <Select<"ALL" | ModuleStatus>
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Published" },
            { value: "DRAFT", label: "Draft" },
            { value: "DISABLED", label: "Disabled" },
          ]}
        />
      </FilterBar>

      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" &&
        (rows.length === 0 ? (
          <EmptyState title={q.data.length ? "No modules match" : "No modules yet"} />
        ) : (
          <Card>
            <Table>
              <caption className="sr-only">Training modules</caption>
              <thead>
                <tr>
                  <Th>Module</Th>
                  <Th>Status</Th>
                  <Th>Content</Th>
                  <Th>Assigned</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.module.id}>
                    <Td>
                      <Link href={`/admin/content/${r.module.id}`} className="font-medium hover:underline">
                        {r.module.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                        {r.module.category} · {r.module.estimatedMinutes} min
                        {r.module.isPlaceholder && <Badge tone="warning">Placeholder</Badge>}
                      </div>
                    </Td>
                    <Td>
                      <ModuleStatusBadge status={r.module.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {r.hasVideo ? "Video" : <span className="text-danger">No video</span>} · {r.checkpointCount} decision pts ·{" "}
                      {r.questionCount} questions
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.assignedCount}
                      {r.assignedCount > 0 && <span className="text-muted"> ({r.completedCount} done)</span>}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(r.module.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}

      <Modal open={creating} title="New module" onClose={() => setCreating(false)}>
        {creating && (
          <DetailsForm
            initial={emptyDetails}
            submitLabel="Create draft"
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const m = await data.createModule(input);
              router.push(`/admin/content/${m.id}`);
            }}
          />
        )}
      </Modal>
    </>
  );
}
