import { describe, expect, it } from "vitest";
import { safeNextPath, validatePassword } from "./password";
import { canAccess, isNavActive, NAV, roleHome } from "./roles";

describe("canAccess", () => {
  it("lets each role into its own area and shared pages only", () => {
    expect(canAccess("LEARNER", "/learn")).toBe(true);
    expect(canAccess("LEARNER", "/learn/training")).toBe(true);
    expect(canAccess("LEARNER", "/profile")).toBe(true);
    expect(canAccess("LEARNER", "/facility")).toBe(false);
    expect(canAccess("LEARNER", "/admin/facilities")).toBe(false);
    expect(canAccess("FACILITY_ADMIN", "/admin")).toBe(false);
    expect(canAccess("SUPER_ADMIN", "/facility/learners")).toBe(false);
  });
  it("isn't fooled by look-alike prefixes", () => {
    expect(canAccess("LEARNER", "/learnings")).toBe(false);
    expect(canAccess("SUPER_ADMIN", "/administrator")).toBe(false);
  });
  it("every nav link is reachable by its own role", () => {
    for (const [role, items] of Object.entries(NAV)) {
      for (const item of items) expect(canAccess(role as keyof typeof NAV, item.href)).toBe(true);
    }
    expect(roleHome("FACILITY_ADMIN")).toBe("/facility");
  });
});

describe("isNavActive", () => {
  it("matches dashboards exactly and sections by prefix", () => {
    const [dash, learners] = NAV.FACILITY_ADMIN;
    expect(isNavActive(dash, "/facility")).toBe(true);
    expect(isNavActive(dash, "/facility/learners")).toBe(false);
    expect(isNavActive(learners, "/facility/learners/usr-1")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("allows in-app paths only (no open redirects)", () => {
    expect(safeNextPath("/learn/training")).toBe("/learn/training");
    expect(safeNextPath("https://evil.test")).toBeNull();
    expect(safeNextPath("//evil.test")).toBeNull();
    expect(safeNextPath("/\\evil.test")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("validatePassword", () => {
  it("requires 8+ characters with a letter and a number", () => {
    expect(validatePassword("short1")).not.toBeNull();
    expect(validatePassword("allletters")).not.toBeNull();
    expect(validatePassword("12345678")).not.toBeNull();
    expect(validatePassword("letters123")).toBeNull();
  });
});
