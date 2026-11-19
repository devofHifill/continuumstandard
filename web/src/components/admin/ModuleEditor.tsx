"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { LoadError } from "@/components/learner/parts";
import { Badge, Button, Card, CardBody, Modal } from "@/components/ui";
import { data, ServiceError, type ModuleEditBundle } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";
import type { ModuleStatus } from "@/lib/types";
import { AssessmentEditor } from "./editor/AssessmentEditor";
import { CheckpointsEditor } from "./editor/CheckpointsEditor";
import { DetailsForm } from "./editor/DetailsForm";
import { ModuleStatusBadge } from "./editor/ModuleStatusBadge";
import { VideoForm } from "./editor/VideoForm";

const TABS = ["Details", "Video", "Decision points", "Knowledge check"] as const;
type Tab = (typeof TABS)[number];

/** Module editor (F5.5–F5.7) with publishing controls (F5.4). Super Admin only (D12). */
export function ModuleEditor() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const q = useQuery(`module-edit:${moduleId}`, () => data.getModuleForEdit(moduleId));
  const [tab, setTab] = useState<Tab>("Details");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/content" className="text-sm font-medium text-primary hover:underline">
        ← Training Content
      </Link>
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError message={q.error.message} />}
      {q.status === "success" && (
        <>
          <Header bundle={q.data} />
          <div role="tablist" aria-label="Module sections" className="flex gap-1 overflow-x-auto border-b border-border">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx(
                  "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium",
                  tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {t}
                {t === "Decision points" && <span className="ml-1 text-xs">({q.data.checkpoints.length})</span>}
                {t === "Knowledge check" && <span className="ml-1 text-xs">({q.data.assessment?.questions.length ?? 0})</span>}
              </button>
            ))}
          </div>
          {/* All sections stay mounted (inactive ones hidden), so switching tabs never loses
              unsaved edits. Each section updates itself from the server's reply when it saves. */}
          <div role="tabpanel" hidden={tab !== "Details"}>
            <Card>
              <CardBody>
                <DetailsForm
                  initial={q.data.module}
                  submitLabel="Save details"
                  onSubmit={async (input) => {
                    await data.updateModuleDetails(moduleId, input);
                  }}
                />
              </CardBody>
            </Card>
          </div>
          <div role="tabpanel" hidden={tab !== "Video"}>
            <VideoForm moduleId={moduleId} video={q.data.video} />
          </div>
          <div role="tabpanel" hidden={tab !== "Decision points"}>
            <CheckpointsEditor
              moduleId={moduleId}
              video={q.data.video}
              checkpoints={q.data.checkpoints}
              answeredCheckpointIds={q.data.answeredCheckpointIds}
              answeredOptionIds={q.data.answeredOptionIds}
            />
          </div>
          <div role="tabpanel" hidden={tab !== "Knowledge check"}>
            <AssessmentEditor
              moduleId={moduleId}
              assessment={q.data.assessment}
              answeredQuestionIds={q.data.answeredQuestionIds}
              answeredOptionIds={q.data.answeredOptionIds}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Header({ bundle }: { bundle: ModuleEditBundle }) {
  const m = bundle.module;
  const [target, setTarget] = useState<ModuleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = bundle.publishProblems.length === 0;

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await data.setModuleStatus(m.id, target);
      setNotice({ ACTIVE: "Published — Facility Admins can now assign it.", DRAFT: "Moved back to draft.", DISABLED: "Disabled — it can't be newly assigned. Learners who have it keep access." }[target]);
      setTarget(null);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't change the status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ModuleStatusBadge status={m.status} />
            {m.isPlaceholder && <Badge tone="warning">Placeholder content</Badge>}
            <span className="text-sm text-muted">
              Assigned to {bundle.assignedCount} learner{bundle.assignedCount === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{m.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status !== "ACTIVE" && (
            <Button onClick={() => setTarget("ACTIVE")} disabled={!ready} title={ready ? undefined : "Finish the checklist below first"}>
              Publish
            </Button>
          )}
          {m.status === "ACTIVE" && (
            <Button variant="secondary" onClick={() => setTarget("DISABLED")}>
              Disable
            </Button>
          )}
          {m.status === "DISABLED" && bundle.assignedCount === 0 && (
            <Button variant="secondary" onClick={() => setTarget("DRAFT")}>
              Move to draft
            </Button>
          )}
        </div>
      </div>

      {notice && <FormAlert tone="success">{notice}</FormAlert>}
      {m.status !== "ACTIVE" && (
        <div className={clsx("rounded-lg px-4 py-3 text-sm", ready ? "bg-success-soft text-success" : "bg-surface-muted")}>
          {ready ? (
            "Ready to publish."
          ) : (
            <>
              <p className="font-semibold">To publish, finish these:</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {bundle.publishProblems.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {m.status === "ACTIVE" && bundle.assignedCount > 0 && (
        <p className="text-sm text-muted">
          This module is live. Edits apply to learners straight away; items learners have already answered can be reworded but not deleted.
        </p>
      )}

      <Modal
        open={!!target}
        title={target === "ACTIVE" ? "Publish this module?" : target === "DISABLED" ? "Disable this module?" : "Move back to draft?"}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant={target === "DISABLED" ? "danger" : "primary"} loading={busy} onClick={confirm}>
              {target === "ACTIVE" ? "Publish" : target === "DISABLED" ? "Disable" : "Move to draft"}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {target === "ACTIVE" && "Facility Admins will be able to assign it to learners. Make sure all clinical content has been approved by The Continuum-Standard."}
          {target === "DISABLED" && "It won't be offered for new assignments. Learners who already have it can still finish or review it."}
          {target === "DRAFT" && "It will be hidden from Facility Admins until published again."}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </Modal>
    </div>
  );
}
