"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScenarioPlayer } from "@/components/player/ScenarioPlayer";
import { Badge, Card, CardBody } from "@/components/ui";
import { data, type MyTrainingDetail, type PlaybackBundle } from "@/lib/data";
import { ButtonLink, checkHref, LoadError, moduleHref } from "./parts";

/** The scenario player inside the learner area (F3.4), replacing the /poc page for real use. */
export function ModulePlay() {
  const { moduleId } = useParams<{ moduleId: string }>();
  // Remount per module so switching modules starts a fresh player.
  return <PlayModule key={moduleId} moduleId={moduleId} />;
}

function PlayModule({ moduleId }: { moduleId: string }) {
  const [bundle, setBundle] = useState<PlaybackBundle | null>(null);
  const [detail, setDetail] = useState<MyTrainingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [answered, setAnswered] = useState(0);

  useEffect(() => {
    // Loaded once on purpose: re-fetching on every progress save would restart the player.
    Promise.all([data.getPlayback(moduleId), data.getMyTraining(moduleId)]).then(
      ([b, d]) => {
        setBundle(b);
        setDetail(d);
        setAnswered(b.responses.length);
      },
      (e: Error) => setError(e.message),
    );
  }, [moduleId]);

  const onEnded = useCallback(() => setEnded(true), []);
  const onDebug = useCallback(
    (d: { state: { answered: Record<string, string> } }) => setAnswered(Object.keys(d.state.answered).length),
    [],
  );

  if (error) return <LoadError message={error} />;
  if (!bundle || !detail) return <p className="text-sm text-muted">Loading scenario…</p>;

  const reviewing = detail.status === "COMPLETED";
  const total = bundle.checkpoints.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href={moduleHref(moduleId)} className="text-sm font-medium text-primary hover:underline">
          ← {bundle.module.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{bundle.module.title}</h1>
          {reviewing && <Badge tone="success">Review mode</Badge>}
          {bundle.module.isPlaceholder && <Badge tone="warning">Placeholder content</Badge>}
        </div>
        <p className="text-sm text-muted">
          Decision points answered: <strong className="text-foreground">{answered}</strong> of {total}
          {reviewing && " · You've completed this module; your answers are kept."}
        </p>
      </div>

      <ScenarioPlayer bundle={bundle} onEnded={onEnded} onDebug={onDebug} />

      {ended && (
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Scenario complete</h2>
              <p className="text-sm text-muted">
                {reviewing || !detail.hasAssessment
                  ? "You can watch again any time."
                  : "Next, check what you've learned with a short knowledge check."}
              </p>
            </div>
            {!reviewing && detail.hasAssessment ? (
              <ButtonLink href={checkHref(moduleId)}>Take knowledge check</ButtonLink>
            ) : (
              <ButtonLink href={moduleHref(moduleId)} variant="secondary">
                Back to module
              </ButtonLink>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
