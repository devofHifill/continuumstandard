"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Accessible modal built on the native <dialog> element:
 * focus trapping, Esc-to-close and the backdrop come from the browser.
 */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[var(--radius-card)] border border-border bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
      )}
    </dialog>
  );
}
