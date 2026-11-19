import clsx from "clsx";
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Wraps the table so wide tables scroll inside their card, not the whole page.
 * `relative` keeps absolutely-positioned children (e.g. sr-only labels) inside the
 * scroll box — without it they escape and widen the page on phones.
 */
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative overflow-x-auto">
      <table className={clsx("w-full border-collapse text-sm", className)} {...rest} />
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={clsx(
        "border-b border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("border-b border-border px-4 py-3", className)} {...rest} />;
}
