import { ServiceError, type DemoRequestInput } from "../service";
import { delay, newId, simulateNetwork } from "./helpers";
import { getDb, updateDb } from "./store";

/**
 * Mock public-website endpoint (F6): the "Request a Demo" form.
 *
 * Public, so it re-validates everything (the form's own checks can be bypassed) and caps
 * field lengths. A real endpoint also needs rate limiting / bot protection server-side;
 * the site already has a honeypot field for simple bots.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 120, organization: 160, email: 200, phone: 40, facilities: 20, message: 2000, source: 40 };

const clip = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);

export async function submitDemoRequest(input: DemoRequestInput) {
  simulateNetwork();
  const lead = {
    name: clip(input.name, LIMITS.name),
    organization: clip(input.organization, LIMITS.organization),
    email: clip(input.email, LIMITS.email).toLowerCase(),
    phone: clip(input.phone, LIMITS.phone) || undefined,
    facilities: clip(input.facilities, LIMITS.facilities) || undefined,
    message: clip(input.message, LIMITS.message) || undefined,
    source: clip(input.source, LIMITS.source) || "website",
  };
  if (lead.name.length < 2) throw new ServiceError("VALIDATION", "Enter your name.");
  if (lead.organization.length < 2) throw new ServiceError("VALIDATION", "Enter your facility or organization.");
  if (!EMAIL_RE.test(lead.email)) throw new ServiceError("VALIDATION", "Enter a valid email address.");

  const now = new Date().toISOString();
  // Same person resubmitting within a minute (double-click, retry) → keep one request.
  const duplicate = getDb().leads.some(
    (l) => l.email === lead.email && Date.now() - new Date(l.createdAt).getTime() < 60_000,
  );
  if (duplicate) return delay(undefined);

  updateDb((d) => {
    d.leads.push({ id: newId("lead"), ...lead, createdAt: now });
    d.activity.push({
      id: newId("act"),
      type: "LEAD_RECEIVED",
      actorId: null,
      facilityId: null,
      message: `Demo request from ${lead.name} (${lead.organization})`,
      createdAt: now,
    });
  });
  return delay(undefined);
}
