"use client";

import { useRef, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { Button, Field } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import { isSafeMediaUrl } from "@/lib/content";
import { formatTime } from "@/lib/player/engine";
import type { ScenarioVideo } from "@/lib/types";
import { PreviewVideo } from "./PreviewVideo";

const SAMPLE = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

/**
 * Scenario video (F5.5). The length is read from the video itself when it loads —
 * no typing durations by hand — and decision points are checked against it.
 */
export function VideoForm({ moduleId, video }: { moduleId: string; video?: ScenarioVideo }) {
  const [sourceUrl, setSourceUrl] = useState(video?.sourceUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(video?.sourceUrl ?? "");
  const [posterUrl, setPosterUrl] = useState(video?.posterUrl ?? "");
  const [captionsUrl, setCaptionsUrl] = useState(video?.captionsUrl ?? "");
  const [duration, setDuration] = useState<number | null>(video?.durationSec ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  function preview(url = sourceUrl) {
    setSaved(false);
    if (!isSafeMediaUrl(url)) return setError("Enter an https:// link to an HLS (.m3u8) or MP4 video.");
    setError(null);
    setDuration(null);
    setPreviewUrl(url.trim());
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (previewUrl !== sourceUrl.trim()) return setError("Load the preview first, so the video's length can be read.");
    if (!duration) return setError("Wait for the preview to load so its length is known.");
    setSaving(true);
    setError(null);
    try {
      await data.saveModuleVideo(moduleId, { sourceUrl, durationSec: duration, posterUrl, captionsUrl });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : "Couldn't save the video.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        {saved && <FormAlert tone="success">Video saved.</FormAlert>}
        <Field
          label="Video link"
          placeholder="https://…/video.m3u8"
          value={sourceUrl}
          onChange={(e) => {
            setSourceUrl(e.target.value);
            setSaved(false);
          }}
          hint="An HLS stream (from the video host, e.g. Mux) or an MP4 file."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => preview()}>
            Load preview
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSourceUrl(SAMPLE);
              preview(SAMPLE);
            }}
          >
            Use sample stream
          </Button>
        </div>
        <Field label="Poster image (optional)" placeholder="https:// or /thumbnails/…" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
        <Field
          label="Captions file (optional)"
          placeholder="https://…/captions.vtt"
          value={captionsUrl}
          onChange={(e) => setCaptionsUrl(e.target.value)}
          hint="WebVTT (.vtt). Captions are strongly recommended for accessibility."
        />
        <p className="text-sm">
          Length: <strong>{duration ? `${formatTime(duration)} (${duration.toFixed(1)} s)` : previewUrl ? "loading…" : "—"}</strong>
        </p>
        <div>
          <Button type="submit" loading={saving} disabled={!sourceUrl.trim()}>
            Save video
          </Button>
        </div>
      </div>
      <div>
        {previewUrl ? (
          <>
            <PreviewVideo src={previewUrl} videoRef={ref} onDuration={setDuration} onError={setLoadError} />
            {loadError && <p className="mt-2 text-sm text-danger">{loadError}</p>}
          </>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
            No video yet
          </div>
        )}
      </div>
    </form>
  );
}
