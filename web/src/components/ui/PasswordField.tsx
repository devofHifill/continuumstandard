"use client";

import { useState } from "react";
import { Field, type FieldProps } from "./Field";

/** Password input with a show/hide toggle (helps people on phones avoid typos). */
export function PasswordField(props: Omit<FieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={visible ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1 top-[1.85rem] h-8 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-muted"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
