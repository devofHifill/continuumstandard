"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { formatTime } from "@/lib/player/engine";
import { attachSource } from "@/lib/player/videoSource";

/**
 * Plain preview player for editors: native controls, free seeking, no decision points.
 * Uses the same provider adapter as the learner player, so "it previews" means "it will play".
 */
export function PreviewVideo({
  src,
  videoRef,
  onDuration,
  onError,
}: {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onDuration?: (sec: number) => void;
  onError?: (message: string | null) => void;
}) {
  const [time, setTime] = useState(0);
  const onDurationRef = useRef(onDuration);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onDurationRef.current = onDuration;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    let detach: (() => void) | undefined;
    let cancelled = false;
    onErrorRef.current?.(null);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) onDurationRef.current?.(el.duration);
    };
    const onTime = () => setTime(el.currentTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    attachSource(el, src, { onFatalError: (m) => onErrorRef.current?.(m) }).then((d) => (cancelled ? d() : (detach = d)));
    return () => {
      cancelled = true;
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
      detach?.();
    };
  }, [src, videoRef]);

  return (
    <div className="flex flex-col gap-1">
      <video ref={videoRef} controls playsInline muted preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
      <p className="text-xs text-muted">
        Current time: <span className="font-mono">{formatTime(time)}</span> ({time.toFixed(1)} s)
      </p>
    </div>
  );
}

/** "1:35", "01:35" or "95" → seconds. Returns NaN if it can't be read. */
export function parseTime(text: string): number {
  const t = text.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^(\d+):([0-5]?\d(?:\.\d+)?)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
