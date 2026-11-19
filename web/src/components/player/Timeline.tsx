"use client";

import clsx from "clsx";
import { formatTime } from "@/lib/player/engine";
import type { DecisionCheckpoint, ID } from "@/lib/types";

type Props = {
  currentTime: number;
  duration: number;
  /** Learner can't seek past this (decision D4). */
  seekLimit: number;
  checkpoints: DecisionCheckpoint[];
  answered: Record<ID, ID>;
  disabled: boolean;
  onSeek: (t: number) => void;
};

/**
 * Progress bar with decision-point markers. Visually it's a styled bar; the real control
 * is a native range input laid over it (invisible but focusable), so keyboard and
 * screen-reader support come from the browser.
 */
export function Timeline({ currentTime, duration, seekLimit, checkpoints, answered, disabled, onSeek }: Props) {
  const pct = (t: number) => (duration > 0 ? `${Math.min(100, (t / duration) * 100)}%` : "0%");

  return (
    <div className="group relative h-6 w-full rounded-full focus-within:ring-2 focus-within:ring-ring">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
        {/* Area the learner may seek within */}
        <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: pct(seekLimit) }} />
        {/* Played */}
        <div className="absolute inset-y-0 left-0 bg-[var(--ring)]" style={{ width: pct(currentTime) }} />
      </div>

      {checkpoints.map((c) => (
        <span
          key={c.id}
          aria-hidden
          title={`Decision point at ${formatTime(c.timestampSec)}`}
          className={clsx(
            "pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white",
            answered[c.id] ? "bg-white" : "bg-warning",
          )}
          style={{ left: pct(c.timestampSec) }}
        />
      ))}

      <input
        type="range"
        aria-label="Video position"
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        min={0}
        max={duration || 0}
        step={1}
        value={Math.min(currentTime, duration || 0)}
        disabled={disabled || !duration}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span className="sr-only">You can move back freely, but not past what you have already watched.</span>
    </div>
  );
}
