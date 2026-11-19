import type { Role } from "@/lib/types";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  FACILITY_ADMIN: "Facility Admin",
  LEARNER: "Learner",
};

/**
 * Where each role lands after signing in.
 * F0: everyone goes to the temporary /dashboard. F2 replaces these with
 * /admin, /facility and /learner and their own navigation.
 */
export function roleHome(role: Role): string {
  void role;
  return "/dashboard";
}
