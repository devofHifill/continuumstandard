import Link from "next/link";
import type { ReactNode } from "react";

/** Shared look for the 404 and error pages (F7.1). */
export function ErrorScreen({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="font-display text-6xl text-accent">{code}</p>
        <h1 className="font-display text-3xl tracking-tight text-primary">{title}</h1>
        <div className="text-muted">{children}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function LinkButton({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          : "inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
      }
    >
      {children}
    </Link>
  );
}
