import type { Role } from "@/lib/types";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  FACILITY_ADMIN: "Facility Admin",
  LEARNER: "Learner",
};

/** Each role's own area of the app. A route under another role's area is off-limits. */
export const ROLE_AREA: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  FACILITY_ADMIN: "/facility",
  LEARNER: "/learn",
};

/** Where each role lands after signing in. */
export function roleHome(role: Role): string {
  return ROLE_AREA[role];
}

export interface NavItem {
  href: string;
  label: string;
  /** Exact match only (for dashboard links, so they aren't "active" on every sub-page). */
  exact?: boolean;
}

/**
 * Per-role navigation, built from the sitemap in scope doc §11 (decision D1) —
 * not the shared menu in the wireframes, which showed admin links to learners.
 * Leads is decision D9 (pending client confirmation).
 */
export const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/facilities", label: "Facilities" },
    { href: "/admin/facility-admins", label: "Facility Admins" },
    { href: "/admin/content", label: "Training Content" },
    { href: "/admin/activity", label: "Activity" },
    { href: "/admin/leads", label: "Demo Requests" },
  ],
  FACILITY_ADMIN: [
    { href: "/facility", label: "Dashboard", exact: true },
    { href: "/facility/learners", label: "Learners" },
    { href: "/facility/assignments", label: "Assignments" },
    { href: "/facility/progress", label: "Learner Progress" },
  ],
  LEARNER: [
    { href: "/learn", label: "Dashboard", exact: true },
    { href: "/learn/training", label: "Assigned Training" },
    { href: "/learn/progress", label: "My Progress" },
  ],
};

/** Routes every signed-in role may open. */
export const SHARED_PATHS = ["/profile"];

/** Can this role open this path? Used by route guards and to vet `next=` redirects. */
export function canAccess(role: Role, path: string): boolean {
  const area = ROLE_AREA[role];
  const inArea = path === area || path.startsWith(`${area}/`);
  const shared = SHARED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  return inArea || shared;
}

export function isNavActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
