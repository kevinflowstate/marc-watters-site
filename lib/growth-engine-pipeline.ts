/**
 * Growth Engine sales pipeline: consultations Marc's clients book with Kevin.
 * Bookings arrive from the Flowstate CRM calendar (CBB Growth Engine) via webhook.
 */

export const PIPELINE_STAGES = ["call_booked", "proposal", "follow_up", "won", "lost"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_META: Record<PipelineStage, { label: string; hint: string; tone: string }> = {
  call_booked: { label: "Call booked", hint: "Fills itself from the booking page", tone: "blue" },
  proposal: { label: "Proposal", hint: "Proposal sent, awaiting a decision", tone: "sky" },
  follow_up: { label: "Follow up", hint: "Needs another touch", tone: "amber" },
  won: { label: "Won", hint: "Signed and moving to live", tone: "green" },
  lost: { label: "Lost", hint: "Not going ahead", tone: "grey" },
};

/** Public booking page and the CRM calendar it embeds. */
export const GROWTH_ENGINE_CALENDAR_ID = "eNaebTx6TpVkXgGe2CZI";
export const GROWTH_ENGINE_BOOKING_PATH = "/cbbgrowthengine";

export interface PipelineDeal {
  id: string;
  stage: PipelineStage;
  position: number;
  contact_name: string;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  client_id: string | null;
  ghl_contact_id: string | null;
  ghl_appointment_id: string | null;
  appointment_at: string | null;
  appointment_status: string | null;
  proposal_url: string | null;
  proposal_value: number | null;
  proposal_sent_at: string | null;
  proposal_file_name: string | null;
  has_proposal_file: boolean;
  follow_up_at: string | null;
  notes: string | null;
  lost_reason: string | null;
  source: "calendar" | "manual";
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
}

export const DEAL_COLUMNS =
  "id, stage, position, contact_name, email, phone, business_name, client_id, ghl_contact_id, ghl_appointment_id, appointment_at, appointment_status, proposal_url, proposal_value, proposal_sent_at, proposal_file_path, proposal_file_name, follow_up_at, notes, lost_reason, source, stage_changed_at, created_at, updated_at";

export function toDeal(row: Record<string, unknown>): PipelineDeal {
  const { proposal_file_path, proposal_value, position, ...rest } = row as Record<string, unknown> & { proposal_file_path?: string | null };
  return {
    ...(rest as unknown as PipelineDeal),
    position: Number(position) || 0,
    proposal_value: proposal_value === null || proposal_value === undefined ? null : Number(proposal_value),
    has_proposal_file: Boolean(proposal_file_path),
  };
}

export function isStage(value: unknown): value is PipelineStage {
  return typeof value === "string" && (PIPELINE_STAGES as readonly string[]).includes(value);
}

/** Editable fields from the admin drawer. Returns only keys that were sent, cleaned. */
export function cleanDealPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  const text = (key: string, max: number) => {
    if (!(key in body)) return;
    const raw = body[key];
    patch[key] = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, max) : null;
  };
  const date = (key: string) => {
    if (!(key in body)) return;
    const raw = body[key];
    patch[key] = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  };
  text("contact_name", 160);
  text("email", 200);
  text("phone", 60);
  text("business_name", 200);
  text("notes", 5000);
  text("lost_reason", 500);
  date("proposal_sent_at");
  date("follow_up_at");
  if ("proposal_url" in body) {
    const raw = typeof body.proposal_url === "string" ? body.proposal_url.trim() : "";
    patch.proposal_url = /^https?:\/\/\S+$/i.test(raw) ? raw.slice(0, 1000) : null;
  }
  if ("proposal_value" in body) {
    const raw = body.proposal_value;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[£,\s]/g, "")) : NaN;
    patch.proposal_value = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }
  if (patch.contact_name === null) delete patch.contact_name;
  return patch;
}

function str(record: Record<string, unknown> | undefined, ...keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

function obj(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function toIso(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface ParsedBooking {
  appointmentId: string;
  contactId: string;
  calendarId: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  startsAt: string | null;
  status: string;
}

/**
 * Accepts the CRM workflow webhook payload (contact fields at the top, appointment under
 * `calendar`) and the raw appointment event shape (`appointment` object).
 */
export function parseBookingPayload(body: Record<string, unknown>): ParsedBooking {
  const calendar = obj(body.calendar);
  const appointment = obj(body.appointment);
  const contact = obj(body.contact);
  const customData = obj(body.customData);
  const first = str(body, "first_name", "firstName") || str(contact, "first_name", "firstName") || str(appointment, "firstName");
  const last = str(body, "last_name", "lastName") || str(contact, "last_name", "lastName") || str(appointment, "lastName");
  const name =
    str(body, "full_name", "contact_name", "name") ||
    str(contact, "name", "full_name") ||
    [first, last].filter(Boolean).join(" ") ||
    str(appointment, "contactName", "title");
  const rawStatus = (
    str(calendar, "status", "appoinmentStatus", "appointmentStatus") ||
    str(appointment, "appointmentStatus", "status") ||
    str(customData, "status") ||
    "booked"
  ).toLowerCase();
  const type = str(body, "type").toLowerCase();
  return {
    appointmentId:
      str(calendar, "appointmentId", "id") || str(appointment, "id", "appointmentId") || str(customData, "appointment_id", "appointmentId"),
    contactId: str(body, "contact_id", "contactId") || str(contact, "id") || str(appointment, "contactId"),
    calendarId: str(calendar, "id", "calendarId") || str(appointment, "calendarId") || str(customData, "calendar_id"),
    name,
    email: (str(body, "email") || str(contact, "email") || str(appointment, "email")).toLowerCase(),
    phone: str(body, "phone") || str(contact, "phone") || str(appointment, "phone"),
    businessName: str(body, "company_name", "companyName") || str(contact, "company_name", "companyName"),
    startsAt: toIso(str(calendar, "startTime", "start_time") || str(appointment, "startTime") || str(customData, "start_time")),
    status: type.includes("delete") ? "cancelled" : rawStatus,
  };
}

export function isCancelledStatus(status: string | null | undefined) {
  return !!status && /cancel|delete|invalid/i.test(status);
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}
