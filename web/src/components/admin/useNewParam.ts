"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * `?new=1` opens a page's "create" form (used by dashboard quick actions).
 * Also re-triggers when Next.js restores an already-mounted page and the link is used again.
 * Returns [open, setOpen]; closing clears the query string.
 */
export function useNewParam(path: string): [boolean, (open: boolean) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const flag = params.get("new");
  const [open, setOpenState] = useState(!!flag);
  const [seen, setSeen] = useState(flag);
  if (flag !== seen) {
    setSeen(flag);
    if (flag) setOpenState(true);
  }
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next && params.get("new")) router.replace(path);
  };
  return [open, setOpen];
}
