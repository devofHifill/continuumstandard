"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScenarioPlayer, type PlayerDebug } from "@/components/player/ScenarioPlayer";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { data, type PlaybackBundle } from "@/lib/data";
import { useSession } from "@/lib/data/hooks";
import { DEMO_TOOLS_ENABLED, getNetworkFailure, setNetworkFailure } from "@/lib/data/mock/demo";
import { formatTime } from "@/lib/player/engine";
import type { Session } from "@/lib/types";

/** The §7.1 proof-of-concept module: one video, first decision point at 00:30. */
const POC_MODULE_ID = "mod-intake";

export function PocClient() {
  const session = useSession();
  if (session === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (!session || session.role !== "LEARNER") return <NeedLearner signedIn={!!session} />;
  // Remount per user so switching demo accounts loads their own progress.
  return <PocForLearner key={session.userId} session={session} />;
}

function PocForLearner({ session }: { session: Session }) {
  const [bundle, setBundle] = useState<PlaybackBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<PlayerDebug | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    // Loaded once on purpose: re-fetching on every progress save would restart the player.
    data.getPlayback(POC_MODULE_ID).then(setBundle, (e: Error) => setError(e.message));
  }, []);

  const onDebug = useCallback((d: PlayerDebug) => setDebug(d), []);
  const onEnded = useCallback(() => setEnded(true), []);

  if (error) {
    return (
      <Card>
        <CardBody className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">This module isn&apos;t assigned to {session.name}</h1>
          <p className="text-sm text-muted">
            {error} Sign in as Jordan Lee (not started) or Alex Rivera (in progress) to try the player.
          </p>
        </CardBody>
      </Card>
    );
  }
  if (!bundle) return <p className="text-sm text-muted">Loading module…</p>;

  const answeredCount = debug ? Object.keys(debug.state.answered).length : bundle.responses.length;
  const total = bundle.checkpoints.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Module header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">Video engine proof of concept</Badge>
          {bundle.module.isPlaceholder && <Badge tone="warning">Placeholder content</Badge>}
        </div>
        <h1 className="text-2xl font-semibold">{bundle.module.title}</h1>
        <p className="max-w-2xl text-muted">{bundle.module.description}</p>
        <div className="flex items-center gap-3 text-sm">
          <span>
            Decision points: <strong>{answeredCount}</strong> of {total}
          </span>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <ScenarioPlayer bundle={bundle} onDebug={onDebug} onEnded={onEnded} />

      {ended && (
        <Card>
          <CardBody className="flex flex-col gap-1">
            <h2 className="font-semibold">Scenario complete</h2>
            <p className="text-sm text-muted">
              The knowledge check comes next — it&apos;s built in phase F3. Press play to watch the scenario again; your
              answers are kept.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AcceptanceChecklist />
        {DEMO_TOOLS_ENABLED && debug && <DebugPanel debug={debug} />}
      </div>
    </div>
  );
}

function AcceptanceChecklist() {
  const steps = [
    "Press play — the video starts.",
    "At 00:30 the video pauses by itself.",
    "A question with four answer options appears; play and seek are locked.",
    "Choose an answer and submit — it's saved.",
    "Approved feedback (placeholder) appears.",
    "Continue — the video resumes from 00:30.",
    "Refresh the page — it resumes where you left off and your answer is kept.",
    "Try dragging the bar ahead — it snaps back to what you've watched.",
  ];
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">§7.1 acceptance test</h2>
      </CardHeader>
      <CardBody>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function DebugPanel({ debug }: { debug: PlayerDebug }) {
  const [offline, setOffline] = useState(getNetworkFailure);
  const rows: [string, string][] = [
    ["Phase", debug.state.phase],
    ["Current time", formatTime(debug.currentTime)],
    ["Furthest watched", formatTime(debug.furthestSec)],
    ["Seek limit", formatTime(debug.seekLimit)],
    ["Answered", Object.keys(debug.state.answered).join(", ") || "—"],
    ["Last save", debug.saveStatus],
  ];
  return (
    <Card className="border-dashed">
      <CardHeader className="flex items-center justify-between">
        <h2 className="font-semibold">Engine state (demo)</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => {
              setNetworkFailure(e.target.checked);
              setOffline(e.target.checked);
            }}
            className="accent-[var(--danger)]"
          />
          Simulate save failures
        </label>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono">{v}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

function NeedLearner({ signedIn }: { signedIn: boolean }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Sign in as a learner to try the player</h1>
        <p className="text-sm text-muted">
          {signedIn ? "Only learners can play assigned training. " : ""}
          Use the demo toolbar or the{" "}
          <Link href="/login" className="underline">
            sign-in page
          </Link>{" "}
          and choose <strong>Jordan Lee</strong> (not started) or <strong>Alex Rivera</strong> (in progress).
        </p>
      </CardBody>
    </Card>
  );
}
