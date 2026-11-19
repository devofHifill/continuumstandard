"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { Button, Field, TextArea } from "@/components/ui";
import { ServiceError, type ModuleDetailsInput } from "@/lib/data";
import { moduleDetailProblems } from "@/lib/content";

/** Sample artwork that ships with the app; any https:// image also works. */
export const THUMBNAILS = [
  { url: "/thumbnails/mod-intake.svg", label: "Teal" },
  { url: "/thumbnails/mod-ama.svg", label: "Blue" },
  { url: "/thumbnails/mod-boundaries.svg", label: "Purple" },
];

export const emptyDetails: ModuleDetailsInput = {
  title: "",
  description: "",
  category: "",
  learningObjectives: [],
  thumbnailUrl: THUMBNAILS[0].url,
  estimatedMinutes: 10,
};

/** Module details (F5.5): title, category, time, description, objectives, thumbnail. */
export function DetailsForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ModuleDetailsInput;
  submitLabel: string;
  onSubmit: (input: ModuleDetailsInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({ ...initial, objectivesText: initial.learningObjectives.join("\n") });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const custom = !THUMBNAILS.some((t) => t.url === form.thumbnailUrl);

  const input = (): ModuleDetailsInput => ({
    title: form.title,
    description: form.description,
    category: form.category,
    learningObjectives: form.objectivesText.split("\n").map((s) => s.trim()).filter(Boolean),
    thumbnailUrl: form.thumbnailUrl,
    estimatedMinutes: Number(form.estimatedMinutes),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems = moduleDetailProblems(input());
    if (problems.length) return setErrors(problems);
    setErrors([]);
    setSaving(true);
    try {
      await onSubmit(input());
      setSaved(true);
    } catch (err) {
      setErrors([err instanceof ServiceError ? err.message : "Couldn't save."]);
    } finally {
      setSaving(false);
    }
  }

  const change = (patch: Partial<typeof form>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.length > 0 && <FormAlert>{errors.join(" ")}</FormAlert>}
      {saved && <FormAlert tone="success">Details saved.</FormAlert>}
      <Field label="Title" value={form.title} onChange={(e) => change({ title: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" value={form.category} onChange={(e) => change({ category: e.target.value })} hint="e.g. De-escalation" />
        <Field
          label="Estimated time (minutes)"
          type="number"
          min={1}
          max={600}
          value={form.estimatedMinutes}
          onChange={(e) => change({ estimatedMinutes: Number(e.target.value) })}
        />
      </div>
      <TextArea label="Description" value={form.description} onChange={(e) => change({ description: e.target.value })} />
      <TextArea
        label="Learning objectives"
        rows={4}
        value={form.objectivesText}
        onChange={(e) => change({ objectivesText: e.target.value })}
        hint="One per line. Supplied by The Continuum-Standard's clinical team."
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Thumbnail</legend>
        <div className="flex flex-wrap gap-3">
          {THUMBNAILS.map((t) => (
            <label key={t.url} className="flex cursor-pointer flex-col items-center gap-1 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- local SVG */}
              <img
                src={t.url}
                alt=""
                className={`h-16 w-28 rounded-md object-cover ring-2 ${form.thumbnailUrl === t.url ? "ring-primary" : "ring-transparent"}`}
              />
              <span className="flex items-center gap-1">
                <input type="radio" name="thumb" checked={form.thumbnailUrl === t.url} onChange={() => change({ thumbnailUrl: t.url })} />
                {t.label}
              </span>
            </label>
          ))}
        </div>
        <Field
          label="…or an image link"
          placeholder="https://"
          value={custom ? form.thumbnailUrl : ""}
          onChange={(e) => change({ thumbnailUrl: e.target.value || THUMBNAILS[0].url })}
        />
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
