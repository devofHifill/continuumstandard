"use client";

import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { data, ServiceError, type PlaybackBundle } from "@/lib/data";
import {
  advanceFurthest,
  answeredFrom,
  clampSeek,
  dueCheckpoint,
  formatTime,
  initialState,
  maxSeekable,
  reducer,
  type PlayerState,
} from "@/lib/player/engine";
import { attachSource } from "@/lib/player/videoSource";
import { CheckpointPanel } from "./CheckpointPanel";
import { Timeline } from "./Timeline";

/** How often progress is saved while playing (ms). */
const SAVE_INTERVAL_MS = 5000;

export type PlayerDebug = {
  state: PlayerState;
  currentTime: number;
  furthestSec: number;
  seekLimit: number;
  saveStatus: SaveStatus;
};
type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  bundle: PlaybackBundle;
  onEnded?: () => void;
  /** Called with engine internals, for the POC debug panel. */
  onDebug?: (d: PlayerDebug) => void;
};

/**
 * Scenario video player (F1).
 *
 * The rules live in lib/player/engine.ts; this component connects them to a real
 * <video> element:
 *   - a requestAnimationFrame loop checks the time every frame while playing and pauses
 *     exactly on a decision point (the video's own `timeupdate` only fires ~4×/second);
 *   - forward seeks are clamped to what has been watched (decision D4);
 *   - progress is saved every few seconds, on pause, at each decision point and when
 *     the page is hidden, so a refresh resumes where the learner left off.
 */
export function ScenarioPlayer({ bundle, onEnded, onDebug }: Props) {
  const { module, video, checkpoints, responses, progress } = bundle;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reducer, answeredFrom(responses), initialState);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSec);
  const [furthest, setFurthest] = useState(progress.furthestSec);
  const [buffering, setBuffering] = useState(false);
  const [networkTrouble, setNetworkTrouble] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Refs mirror state for the animation-frame loop and event listeners,
  // which must read the latest values without re-subscribing every render.
  const stateRef = useRef(state);
  const furthestRef = useRef(progress.furthestSec);
  /** Latest known position. Survives Next.js hiding/restoring the page (see below). */
  const positionRef = useRef(progress.lastPositionSec);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const videoCompletedRef = useRef(progress.videoCompleted);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Next.js keeps visited pages mounted but hidden (React <Activity>). Hiding runs effect
  // cleanups (which detach the video) but keeps state — so pause on hide, or the player
  // would try to auto-play when the learner comes back.
  useLayoutEffect(() => () => dispatch({ type: "PAUSE" }), []);

  const seekLimit = maxSeekable(checkpoints, state.answered, furthest);
  const locked = state.phase === "checkpoint" || state.phase === "submitting" || state.phase === "feedback";

  useEffect(() => {
    onDebug?.({ state, currentTime, furthestSec: furthest, seekLimit, saveStatus });
  }, [onDebug, state, currentTime, furthest, seekLimit, saveStatus]);

  // ── Saving ─────────────────────────────────────────────
  /**
   * Saves run one after another through a promise queue: none overlap and none are
   * dropped. (An earlier version skipped a save while another was in flight — which
   * could lose the "video finished" save and block the knowledge check.)
   */
  const save = useCallback(
    (extra: { videoCompleted?: boolean } = {}): Promise<void> => {
      if (extra.videoCompleted) videoCompletedRef.current = true;
      const run = async () => {
        const el = videoRef.current;
        if (!el) return;
        setSaveStatus("saving");
        try {
          await data.saveProgress(module.id, {
            positionSec: (positionRef.current = el.currentTime),
            furthestSec: furthestRef.current,
            videoCompleted: videoCompletedRef.current,
          });
          setSaveStatus("saved");
        } catch {
          // Not fatal: the next periodic save retries.
          setSaveStatus("error");
        }
      };
      saveQueueRef.current = saveQueueRef.current.then(run);
      return saveQueueRef.current;
    },
    [module.id],
  );

  const flashNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 2500);
  }, []);

  // ── Load the stream and resume ─────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let detach: (() => void) | undefined;
    let cancelled = false;

    const onLoaded = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
      const answered = stateRef.current.answered;
      // Resume where they left off — or from the start if they'd finished the video.
      let resumeAt = clampSeek(positionRef.current, maxSeekable(checkpoints, answered, furthestRef.current));
      if (progress.videoCompleted && resumeAt >= el.duration - 1) resumeAt = 0;
      el.currentTime = resumeAt;
      setCurrentTime(resumeAt);
      // Refreshed while a question was open? Show it again straight away.
      const due = dueCheckpoint(checkpoints, answered, resumeAt);
      if (due) dispatch({ type: "REACHED_CHECKPOINT", checkpointId: due.id });
    };
    el.addEventListener("loadedmetadata", onLoaded, { once: true });

    attachSource(el, video.sourceUrl, {
      onNetworkTrouble: setNetworkTrouble,
      onFatalError: setFatalError,
    }).then((d) => {
      if (cancelled) d();
      else detach = d;
    });

    return () => {
      cancelled = true;
      el.removeEventListener("loadedmetadata", onLoaded);
      detach?.();
    };
    // Load once per video; progress/checkpoints are only used to resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.sourceUrl]);

  // ── Drive the <video> from the engine's phase ──────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (state.phase === "playing") {
      el.play().catch(() => dispatch({ type: "PAUSE" })); // e.g. autoplay blocked
    } else if (!el.paused) {
      el.pause();
    }
  }, [state.phase]);

  // ── Frame loop: track time, advance furthest, stop at decision points ──
  useEffect(() => {
    if (state.phase !== "playing") return;
    const el = videoRef.current;
    if (!el) return;
    let raf = 0;
    let lastShown = -1;
    let stopped = false;
    let furthestShown = furthestRef.current;

    /** Returns false once playback has been stopped at a decision point. */
    const check = (): boolean => {
      if (stopped) return false;
      const t = el.currentTime;
      const { answered } = stateRef.current;

      const due = dueCheckpoint(checkpoints, answered, t);
      if (due) {
        stopped = true;
        el.pause();
        el.currentTime = due.timestampSec; // land exactly on the decision point
        furthestRef.current = Math.max(furthestRef.current, due.timestampSec);
        setFurthest(furthestRef.current);
        setCurrentTime(due.timestampSec);
        dispatch({ type: "REACHED_CHECKPOINT", checkpointId: due.id });
        void save();
        return false;
      }

      if (!el.seeking) {
        // Update the ref every check (so seek limits are exact); re-render only on bigger steps.
        const next = advanceFurthest(checkpoints, answered, furthestRef.current, t);
        furthestRef.current = next;
        if (next - furthestShown >= 0.25) {
          furthestShown = next;
          setFurthest(next);
        }
      }
      // Re-render ~4×/second for the clock and bar; the check above runs every frame.
      positionRef.current = t;
      if (Math.abs(t - lastShown) >= 0.25) {
        lastShown = t;
        setCurrentTime(t);
      }
      return true;
    };

    const tick = () => {
      if (check()) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Browsers pause animation frames in background tabs while the video keeps playing,
    // so `timeupdate` (~4×/second, still fires when hidden) is the safety net.
    el.addEventListener("timeupdate", check);

    const interval = window.setInterval(() => void save(), SAVE_INTERVAL_MS);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("timeupdate", check);
      window.clearInterval(interval);
    };
  }, [state.phase, checkpoints, save]);

  // ── Native video events ────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onSeeking = () => {
      // Catches seeks from anywhere (keyboard, media keys, devtools), not just our bar.
      const limit = maxSeekable(checkpoints, stateRef.current.answered, furthestRef.current);
      if (el.currentTime > limit + 0.5) {
        el.currentTime = limit;
        flashNotice("You can't skip ahead of what you've watched.");
      }
    };
    const onPlay = () => {
      // Something other than our controls started playback (e.g. a media key).
      const phase = stateRef.current.phase;
      if (phase === "checkpoint" || phase === "submitting" || phase === "feedback") el.pause();
      else if (phase !== "playing") dispatch({ type: "PLAY" });
    };
    const onPause = () => {
      if (stateRef.current.phase === "playing" && !el.ended) {
        dispatch({ type: "PAUSE" });
        void save();
      }
    };
    const onEndedEvent = () => {
      furthestRef.current = el.duration;
      setFurthest(el.duration);
      setCurrentTime(el.duration);
      videoCompletedRef.current = true;
      dispatch({ type: "ENDED" });
      // Tell the page only once "finished" is saved, so the next step (the check) is unlocked.
      void save({ videoCompleted: true }).then(() => onEnded?.());
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };

    el.addEventListener("seeking", onSeeking);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEndedEvent);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onPlaying);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      el.removeEventListener("seeking", onSeeking);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEndedEvent);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onPlaying);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [checkpoints, save, flashNotice, onEnded]);

  // ── Learner actions ────────────────────────────────────
  const togglePlay = () => {
    if (locked) return;
    dispatch({ type: state.phase === "playing" ? "PAUSE" : "PLAY" });
  };

  const seek = (target: number) => {
    const el = videoRef.current;
    if (!el || locked) return;
    const landed = clampSeek(target, seekLimit);
    if (target > seekLimit + 0.5) flashNotice("You can't skip ahead of what you've watched.");
    el.currentTime = positionRef.current = landed;
    setCurrentTime(landed);
  };

  const submit = async () => {
    if (state.phase !== "checkpoint" || !state.activeCheckpointId || !state.selectedOptionId) return;
    dispatch({ type: "SUBMIT" });
    try {
      const result = await data.submitCheckpointResponse(state.activeCheckpointId, state.selectedOptionId);
      dispatch({ type: "SUBMIT_OK", result });
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : "Your answer couldn't be saved.";
      dispatch({ type: "SUBMIT_FAIL", message });
    }
  };

  const toggleFullscreen = () => {
    const box = containerRef.current;
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.requestFullscreen?.();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (locked || (e.target as HTMLElement).closest("input, button, select, textarea")) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seek(currentTime - 5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seek(currentTime + 5);
    }
  };

  const active = checkpoints.find((c) => c.id === state.activeCheckpointId);
  const activeIndex = active ? checkpoints.indexOf(active) : -1;
  const showBigPlay = !locked && state.phase !== "playing" && !fatalError;

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-center [&:fullscreen]:bg-black"
    >
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          poster={video.posterUrl}
          playsInline
          muted={muted}
          preload="metadata"
          onClick={togglePlay}
          className="h-full w-full"
        >
          {video.captionsUrl && <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" default />}
        </video>

        {showBigPlay && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={state.phase === "ended" ? "Watch again" : currentTime > 0 ? "Resume" : "Play"}
            className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
          >
            <PlayIcon className="size-9 translate-x-0.5" />
          </button>
        )}

        {buffering && state.phase === "playing" && (
          <div aria-hidden className="pointer-events-none absolute inset-0 m-auto size-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        )}

        {(networkTrouble || fatalError || notice) && (
          <div
            role="status"
            className={clsx(
              "absolute inset-x-3 top-3 rounded-lg px-3 py-2 text-sm",
              fatalError ? "bg-danger text-white" : "bg-black/75 text-white",
            )}
          >
            {fatalError ?? (networkTrouble ? "Connection problem — reconnecting…" : notice)}
          </div>
        )}

        {/* Decision point overlay on larger screens */}
        {active && locked && (
          <div className="absolute inset-0 hidden items-center justify-center bg-black/70 p-6 sm:flex">
            <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-[var(--radius-card)] bg-surface p-6 text-foreground shadow-xl">
              <CheckpointPanel
                checkpoint={active}
                index={activeIndex}
                total={checkpoints.length}
                phase={state.phase as "checkpoint" | "submitting" | "feedback"}
                selectedOptionId={state.selectedOptionId}
                feedback={state.feedback}
                error={state.error}
                onSelect={(optionId) => dispatch({ type: "SELECT", optionId })}
                onSubmit={submit}
                onContinue={() => dispatch({ type: "CONTINUE" })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 bg-primary-hover px-3 pt-2 pb-3 text-white">
        <Timeline
          currentTime={currentTime}
          duration={duration}
          seekLimit={seekLimit}
          checkpoints={checkpoints}
          answered={state.answered}
          disabled={locked}
          onSeek={seek}
        />
        <div className="flex items-center gap-1 text-sm">
          <IconButton label={state.phase === "playing" ? "Pause" : "Play"} onClick={togglePlay} disabled={locked}>
            {state.phase === "playing" ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton label="Back 10 seconds" onClick={() => seek(currentTime - 10)} disabled={locked}>
            <span className="text-xs font-semibold">−10</span>
          </IconButton>
          <span className="ml-1 tabular-nums" aria-live="off">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span className="ml-auto" />
          <IconButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
            <span className="text-xs font-semibold">{muted ? "Muted" : "Sound"}</span>
          </IconButton>
          <IconButton label="Full screen" onClick={toggleFullscreen}>
            <FullscreenIcon />
          </IconButton>
        </div>
      </div>

      {/* Decision point panel below the video on small screens */}
      {active && locked && (
        <div className="border-t border-border p-4 sm:hidden">
          <CheckpointPanel
            checkpoint={active}
            index={activeIndex}
            total={checkpoints.length}
            phase={state.phase as "checkpoint" | "submitting" | "feedback"}
            selectedOptionId={state.selectedOptionId}
            feedback={state.feedback}
            error={state.error}
            onSelect={(optionId) => dispatch({ type: "SELECT", optionId })}
            onSubmit={submit}
            onContinue={() => dispatch({ type: "CONTINUE" })}
          />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {state.phase === "checkpoint" ? "Video paused for a decision point." : ""}
        {state.phase === "ended" ? "Scenario video finished." : ""}
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 min-w-9 items-center justify-center rounded-md px-2 hover:bg-white/10 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PlayIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}
