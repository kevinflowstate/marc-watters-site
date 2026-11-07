// Minimal CRM (GHL) calls for the failed-payment reminder workflow.
// Verified against https://marketplace.gohighlevel.com/docs/ghl/contacts/ and
// the published OpenAPI spec (GoHighLevel/highlevel-api-docs apps/contacts.json).
// The token is read from the environment and never logged or returned.
import { getEnv } from "@/lib/env";
import { MARC_PAYMENT_LOCATION } from "./payment-policy";

const API = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export type GhlWorkflowOptions = {
  token?: string;
  workflowId?: string;
  locationId?: string;
  fetch?: typeof fetch;
};
export class GhlWorkflowError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

function settings(options: GhlWorkflowOptions) {
  const token = (options.token ?? getEnv("CBB_GHL_PIT_TOKEN"))?.trim();
  const workflowId = (options.workflowId ?? getEnv("OPS_PAYMENT_WORKFLOW_ID"))?.trim();
  if (!token) throw new GhlWorkflowError("CRM token (CBB_GHL_PIT_TOKEN) is not configured", 503);
  if (!workflowId || !/^[A-Za-z0-9-]{8,100}$/.test(workflowId))
    throw new GhlWorkflowError("Reminder workflow (OPS_PAYMENT_WORKFLOW_ID) is not configured", 503);
  return {
    token,
    workflowId,
    locationId: options.locationId ?? MARC_PAYMENT_LOCATION,
    request: options.fetch ?? fetch,
  };
}

export function ghlWorkflowConfigured() {
  return Boolean(getEnv("CBB_GHL_PIT_TOKEN") && getEnv("OPS_PAYMENT_WORKFLOW_ID"));
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

const init = { redirect: "error" as const, cache: "no-store" as const };

function contactPath(contactId: string, workflowId: string) {
  if (!/^[A-Za-z0-9]{8,100}$/.test(contactId))
    throw new GhlWorkflowError("Invalid CRM contact ID", 400);
  return `${API}/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(workflowId)}`;
}

/** POST /contacts/search with an exact email filter in Marc's location. */
export async function findContactsByEmail(email: string, options: GhlWorkflowOptions = {}) {
  const s = settings(options);
  const value = email.trim().toLowerCase();
  if (!value.includes("@")) return [];
  const r = await s.request(`${API}/contacts/search`, {
    ...init,
    method: "POST",
    headers: headers(s.token),
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      locationId: s.locationId,
      page: 1,
      pageLimit: 5,
      filters: [{ field: "email", operator: "eq", value }],
    }),
  });
  if (!r.ok) throw new GhlWorkflowError(`CRM contact search failed (${r.status})`);
  const body = (await r.json()) as { contacts?: { id?: unknown; email?: unknown }[] };
  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  // Re-check the email locally so a loose provider match can never enrol the wrong person.
  return contacts
    .filter((c) => typeof c.id === "string" && String(c.email || "").trim().toLowerCase() === value)
    .map((c) => ({ id: String(c.id), email: value }));
}

/** POST /contacts/{contactId}/workflow/{workflowId}. eventStartTime (ISO 8601) lets a
 * "wait until event start time" step fire at the portal-calculated reminder 1 time. */
export async function addContactToWorkflow(
  contactId: string,
  options: GhlWorkflowOptions & { eventStartTime?: string } = {},
) {
  const s = settings(options);
  const r = await s.request(contactPath(contactId, s.workflowId), {
    ...init,
    method: "POST",
    headers: headers(s.token),
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify(
      options.eventStartTime
        ? { eventStartTime: options.eventStartTime.replace(/\.\d{3}Z$/, "+00:00") }
        : {},
    ),
  });
  if (!r.ok) throw new GhlWorkflowError(`CRM workflow enrolment failed (${r.status})`);
  return { workflow_id: s.workflowId };
}

/** DELETE /contacts/{contactId}/workflow/{workflowId}. A 404 means they are no longer in it. */
export async function removeContactFromWorkflow(contactId: string, options: GhlWorkflowOptions = {}) {
  const s = settings(options);
  const r = await s.request(contactPath(contactId, s.workflowId), {
    ...init,
    method: "DELETE",
    headers: headers(s.token),
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status === 404) return { removed: false, not_in_workflow: true };
  if (!r.ok) throw new GhlWorkflowError(`CRM workflow removal failed (${r.status})`);
  return { removed: true, not_in_workflow: false };
}

/** GET /contacts/{contactId}, used to confirm a manual binding belongs to Marc's location. */
export async function getGhlContact(contactId: string, options: GhlWorkflowOptions = {}) {
  const token = (options.token ?? getEnv("CBB_GHL_PIT_TOKEN"))?.trim();
  if (!token) throw new GhlWorkflowError("CRM token (CBB_GHL_PIT_TOKEN) is not configured", 503);
  if (!/^[A-Za-z0-9]{8,100}$/.test(contactId)) throw new GhlWorkflowError("Invalid CRM contact ID", 400);
  const r = await (options.fetch ?? fetch)(`${API}/contacts/${encodeURIComponent(contactId)}`, {
    ...init,
    headers: headers(token),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new GhlWorkflowError("CRM contact cannot be verified", 409);
  const contact = ((await r.json()) as { contact?: Record<string, unknown> }).contact || {};
  if (contact.id !== contactId || contact.locationId !== (options.locationId ?? MARC_PAYMENT_LOCATION))
    throw new GhlWorkflowError("CRM contact is not in Marc's location", 409);
  return contact;
}
