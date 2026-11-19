"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/shell/AuthCard";
import { Button, Field, Modal } from "@/components/ui";
import { data, ServiceError } from "@/lib/data";
import type { User } from "@/lib/types";

type Props = {
  open: boolean;
  /** Edit this learner, or create a new one when undefined. */
  learner?: User;
  onClose: () => void;
  onSaved: (user: User, created: boolean) => void;
};

/** Add or edit a learner (F4.3). New learners are emailed an invite to set their password (D8). */
export function LearnerFormModal({ open, learner, onClose, onSaved }: Props) {
  // Remount the form each time it opens so it starts from the right values.
  return (
    <Modal open={open} title={learner ? "Edit learner" : "Add learner"} onClose={onClose}>
      {open && <LearnerForm key={learner?.id ?? "new"} learner={learner} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function LearnerForm({ learner, onClose, onSaved }: Omit<Props, "open">) {
  const [name, setName] = useState(learner?.name ?? "");
  const [email, setEmail] = useState(learner?.email ?? "");
  const [jobTitle, setJobTitle] = useState(learner?.jobTitle ?? "");
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v: typeof errors = {};
    if (!name.trim()) v.name = "Enter the learner's name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) v.email = "Enter a valid email address.";
    if (Object.keys(v).length) return setErrors(v);
    setErrors({});
    setSaving(true);
    try {
      const input = { name, email, jobTitle };
      const user = learner ? await data.updateLearner(learner.id, input) : await data.createLearner(input);
      onSaved(user, !learner);
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : "Couldn't save. Please try again.";
      setErrors(/email/i.test(message) ? { email: message } : { form: message });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.form && <FormAlert>{errors.form}</FormAlert>}
      <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
      <Field
        label="Work email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        hint={learner ? "They sign in with this address." : "We'll email an invite to set a password."}
      />
      <Field label="Job title (optional)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {learner ? "Save changes" : "Add and send invite"}
        </Button>
      </div>
    </form>
  );
}
