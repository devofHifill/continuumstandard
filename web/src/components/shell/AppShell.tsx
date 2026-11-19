"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { data } from "@/lib/data";
import { useQuery, useSession } from "@/lib/data/hooks";
import { isNavActive, NAV, ROLE_LABEL, roleHome } from "@/lib/auth/roles";
import type { Session } from "@/lib/types";
import { endSession } from "./AuthGate";

/**
 * Signed-in layout: sidebar on desktop, top bar + slide-in menu on phones.
 * Navigation comes from NAV[role] — each role only ever sees its own links.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState(pathname);

  // Close the phone menu after navigating (adjusting state during render, not in an effect).
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (!session) return null; // AuthGate shows the loader

  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <Sidebar session={session} />
      </aside>

      {/* Phone menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-surface shadow-xl">
            <Sidebar session={session} onClose={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="-ml-1 flex size-9 items-center justify-center rounded-md hover:bg-surface-muted md:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link href={roleHome(session.role)} className="font-semibold md:hidden">
            Continuum-Standard
          </Link>
          <div className="ml-auto">
            <UserMenu session={session} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ session, onClose }: { session: Session; onClose?: () => void }) {
  const pathname = usePathname();
  const facility = useQuery(`facility:${session.facilityId}`, () =>
    session.facilityId ? data.getFacility(session.facilityId) : Promise.resolve(null),
  );

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <Link href={roleHome(session.role)} className="block font-semibold leading-tight">
            The Continuum-Standard
          </Link>
          <p className="mt-1 truncate text-sm text-muted">
            {session.facilityId ? (facility.data?.name ?? " ") : "Platform administration"}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      <nav aria-label={`${ROLE_LABEL[session.role]} navigation`} className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV[session.role].map((item) => {
            const active = isNavActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex h-10 items-center rounded-lg px-3 text-sm font-medium",
                    active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-5 py-3 text-xs text-muted">{ROLE_LABEL[session.role]}</div>
    </>
  );
}

function UserMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = session.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const signOut = () => endSession(router, "signed-out");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-surface-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{session.name}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">{session.name}</p>
            <p className="truncate text-xs text-muted">{session.email}</p>
          </div>
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-surface-muted"
          >
            Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
