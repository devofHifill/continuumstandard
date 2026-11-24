import { beforeEach, describe, expect, it } from "vitest";
import { ServiceError } from "../service";
import { findByEmail, startSession } from "./helpers";
import { MockDataService } from "./mockService";
import { getDb, resetStore, setStoredSession } from "./store";

/** Public "Request a Demo" endpoint (F6). */
const api = new MockDataService();

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof ServiceError ? e.code : "UNEXPECTED";
  }
}

const valid = { name: "Jo Rivera", organization: "Lakeside Program", email: "Jo@Lakeside.test", facilities: "2–5", source: "homepage" };

beforeEach(() => {
  resetStore();
  setStoredSession(null); // a website visitor isn't signed in
});

describe("submitDemoRequest", () => {
  it("works without signing in and lands in the Super Admin's Demo Requests", async () => {
    await api.submitDemoRequest(valid);
    startSession(findByEmail("super@continuum.test")!);
    const leads = await api.listLeads();
    expect(leads[0]).toMatchObject({ name: "Jo Rivera", email: "jo@lakeside.test", facilities: "2–5", source: "homepage" });
    expect(getDb().activity.at(-1)!.type).toBe("LEAD_RECEIVED");
  });

  it("re-validates on the server (the form's checks can be bypassed)", async () => {
    expect(await code(api.submitDemoRequest({ ...valid, email: "not-an-email" }))).toBe("VALIDATION");
    expect(await code(api.submitDemoRequest({ ...valid, name: " " }))).toBe("VALIDATION");
  });

  it("caps field lengths and ignores a quick duplicate resubmission", async () => {
    const before = getDb().leads.length;
    await api.submitDemoRequest({ ...valid, message: "x".repeat(10_000) });
    await api.submitDemoRequest(valid); // double-click / retry within a minute
    expect(getDb().leads.length).toBe(before + 1);
    expect(getDb().leads.at(-1)!.message!.length).toBe(2000);
  });
});
