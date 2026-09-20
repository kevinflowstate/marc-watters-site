import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "../../../../lib/env";
import { rateLimit } from "../../../../lib/rate-limit";
import { WEBINAR, WEBINAR_THANK_YOU_PATH } from "../../../../lib/webinar";

export const runtime = "nodejs";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_LOCATION_ID = "93GJEdsr0cT9el3OINXq";
const GHL_VERSION = "2021-07-28";

const TAGS = {
  event: "webinar-2026-10-15",
  organic: "webinar-2026-10-15-organic",
  whatsapp: "webinar-2026-10-15-whatsapp-consent",
} as const;

const FIELDS = {
  eventId: "N67igeZ667S36RxnTYt9",
  startAt: "8RUtVM205Um2gQyWM3Cd",
  source: "FX2CXYXn3Q1BuBaQNDVf",
  emailConsent: "1MpfBoqwbQFm1KtzXRwU",
  whatsappConsent: "tOdm7Ru7nrdfOE1dvEGG",
  consentVersion: "IcNYoefW0V3UsD8DieXn",
  consentCapturedAt: "V2CiXrJX7gZ9gXmzKlRf",
  attribution: "zHUstJ6GIcCTi5xLA1xL",
} as const;

type RegistrationBody = {
  eventId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  businessName?: unknown;
  companyWebsite?: unknown;
  emailConsent?: unknown;
  whatsappConsent?: unknown;
  consentVersion?: unknown;
  utm?: Record<string, unknown>;
  landingPage?: unknown;
  referrer?: unknown;
};

type GhlContact = {
  id?: string;
  locationId?: string;
  tags?: string[];
  customFields?: Array<{
    id?: string;
    value?: unknown;
    fieldValue?: unknown;
    field_value?: unknown;
  }>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTRATION_CLOSE_MS = Date.parse(WEBINAR.startUtc);

export function registrationClosed(nowMs: number) {
  return nowMs >= REGISTRATION_CLOSE_MS;
}

function cleanText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePhone(value: unknown) {
  const raw = cleanText(value, 40);
  if (!raw) return "";
  const prefix = raw.startsWith("+") ? "+" : "";
  return prefix + raw.replace(/\D/g, "");
}

function cleanPageUrl(value: unknown) {
  const candidate = cleanText(value, 1000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return "";
  }
}

function compactAttribution(body: RegistrationBody) {
  const values = {
    landingPage: cleanPageUrl(body.landingPage),
    referrer: cleanPageUrl(body.referrer),
    utm_source: cleanText(body.utm?.source, 100),
    utm_medium: cleanText(body.utm?.medium, 100),
    utm_campaign: cleanText(body.utm?.campaign, 100),
    utm_content: cleanText(body.utm?.content, 100),
    utm_term: cleanText(body.utm?.term, 100),
  };
  return JSON.stringify(Object.fromEntries(Object.entries(values).filter(([, value]) => value))).slice(0, 2000);
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
  };
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function contactFieldValue(contact: GhlContact, fieldId: string) {
  const field = contact.customFields?.find((item) => item.id === fieldId);
  return field?.value ?? field?.fieldValue ?? field?.field_value;
}

export async function POST(request: NextRequest) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return NextResponse.json({ ok: false, code: "invalid_content_type", message: "Please submit the registration form again." }, { status: 415 });
  }

  const limit = rateLimit(`webinar:${clientIp(request)}`, 8, 10 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: RegistrationBody;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as RegistrationBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json", message: "Please submit the registration form again." }, { status: 400 });
  }

  if (cleanText(body.companyWebsite)) {
    return NextResponse.json({ ok: false, code: "validation_error", message: "Please check your details and try again." }, { status: 400 });
  }

  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = normalizePhone(body.phone);
  const businessName = cleanText(body.businessName, 160);
  const emailConsent = body.emailConsent === true;
  const whatsappConsent = body.whatsappConsent === true;
  const fieldErrors: Record<string, string> = {};

  if (body.eventId !== WEBINAR.id) fieldErrors.eventId = "This registration link is no longer valid.";
  if (firstName.length < 2) fieldErrors.firstName = "Enter your first name.";
  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (phone && !/^\+[0-9]{7,15}$/.test(phone)) fieldErrors.phone = "Start with + and include your country code, for example +44 or +353.";
  if (whatsappConsent && !/^\+[0-9]{7,15}$/.test(phone)) fieldErrors.phone = "Enter your mobile number with country code to receive WhatsApp updates.";
  if (!emailConsent) fieldErrors.emailConsent = "Email permission is required so we can send your joining details.";
  if (body.consentVersion !== WEBINAR.consentVersion) fieldErrors.emailConsent = "Please review and accept the current communication wording.";

  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ ok: false, code: "validation_error", message: "Check the highlighted details and try again.", fieldErrors }, { status: 400 });
  }

  if (registrationClosed(Date.now())) {
    return NextResponse.json({ ok: false, code: "registration_closed", message: "Registration for this live workshop has now closed." }, { status: 410 });
  }

  const registrationEnabled = getEnv("WEBINAR_REGISTRATION_ENABLED") === "true";
  const token = getEnv("GHL_WEBINAR_LOCATION_TOKEN");
  if (!registrationEnabled || !token) {
    return NextResponse.json({ ok: false, code: "registration_unavailable", message: "Registration is not open just yet. Please check back shortly." }, { status: 503 });
  }

  const capturedAt = new Date().toISOString();
  const attribution = compactAttribution(body);
  const customFields = [
    { id: FIELDS.eventId, fieldValue: WEBINAR.id },
    { id: FIELDS.startAt, fieldValue: "2026-10-15T19:00:00+01:00" },
    { id: FIELDS.source, fieldValue: WEBINAR.source },
    { id: FIELDS.emailConsent, fieldValue: "Yes" },
    { id: FIELDS.whatsappConsent, fieldValue: whatsappConsent ? "Yes" : "No" },
    { id: FIELDS.consentVersion, fieldValue: WEBINAR.consentVersion },
    { id: FIELDS.consentCapturedAt, fieldValue: capturedAt },
    { id: FIELDS.attribution, fieldValue: attribution },
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const upsertResponse = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        firstName,
        ...(lastName ? { lastName } : {}),
        email,
        ...(phone ? { phone } : {}),
        ...(businessName ? { companyName: businessName } : {}),
        customFields,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const upsertBody = await parseJson(upsertResponse);
    const contact = (upsertBody?.contact || null) as GhlContact | null;
    if (!upsertResponse.ok || !contact?.id || contact.locationId !== GHL_LOCATION_ID) {
      return NextResponse.json({ ok: false, code: "registration_failed", message: "We couldn't complete your registration. Please try again." }, { status: 502 });
    }

    const requiredTags = [TAGS.event, TAGS.organic, ...(whatsappConsent ? [TAGS.whatsapp] : [])];
    const tagResponse = await fetch(`${GHL_API_BASE}/contacts/${encodeURIComponent(contact.id)}/tags`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify({ tags: requiredTags }),
      cache: "no-store",
      signal: controller.signal,
    });
    const tagBody = await parseJson(tagResponse);
    const savedTags = Array.isArray(tagBody?.tags) ? tagBody.tags.filter((tag): tag is string => typeof tag === "string") : [];
    if (!tagResponse.ok || !requiredTags.every((tag) => savedTags.includes(tag))) {
      return NextResponse.json({ ok: false, code: "registration_failed", message: "We couldn't complete your registration. Please try again." }, { status: 502 });
    }

    let finalTags = savedTags;
    if (!whatsappConsent && savedTags.includes(TAGS.whatsapp)) {
      const removeTagResponse = await fetch(`${GHL_API_BASE}/contacts/${encodeURIComponent(contact.id)}/tags`, {
        method: "DELETE",
        headers: ghlHeaders(token),
        body: JSON.stringify({ tags: [TAGS.whatsapp] }),
        cache: "no-store",
        signal: controller.signal,
      });
      const removeTagBody = await parseJson(removeTagResponse);
      finalTags = Array.isArray(removeTagBody?.tags) ? removeTagBody.tags.filter((tag): tag is string => typeof tag === "string") : [];
      if (!removeTagResponse.ok || finalTags.includes(TAGS.whatsapp)) {
        return NextResponse.json({ ok: false, code: "registration_failed", message: "We couldn't update your communication preferences. Please try again." }, { status: 502 });
      }
    }

    const verifyResponse = await fetch(`${GHL_API_BASE}/contacts/${encodeURIComponent(contact.id)}`, {
      method: "GET",
      headers: ghlHeaders(token),
      cache: "no-store",
      signal: controller.signal,
    });
    const verifyBody = await parseJson(verifyResponse);
    const savedContact = (verifyBody?.contact || null) as GhlContact | null;
    const fieldsMatch =
      savedContact?.id === contact.id &&
      savedContact.locationId === GHL_LOCATION_ID &&
      contactFieldValue(savedContact, FIELDS.eventId) === WEBINAR.id &&
      contactFieldValue(savedContact, FIELDS.source) === WEBINAR.source &&
      contactFieldValue(savedContact, FIELDS.emailConsent) === "Yes" &&
      contactFieldValue(savedContact, FIELDS.whatsappConsent) === (whatsappConsent ? "Yes" : "No") &&
      contactFieldValue(savedContact, FIELDS.consentVersion) === WEBINAR.consentVersion &&
      contactFieldValue(savedContact, FIELDS.attribution) === attribution &&
      requiredTags.every((tag) => finalTags.includes(tag)) &&
      (whatsappConsent || !finalTags.includes(TAGS.whatsapp));

    if (!verifyResponse.ok || !fieldsMatch) {
      return NextResponse.json({ ok: false, code: "registration_failed", message: "We couldn't verify your registration. Please try again." }, { status: 502 });
    }

    const response = NextResponse.json({ ok: true, redirect: WEBINAR_THANK_YOU_PATH }, { status: 201 });
    response.cookies.set("webinar_registration", WEBINAR.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/webinar",
      maxAge: 60 * 60 * 24 * 45,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, code: "registration_failed", message: "We couldn't complete your registration. Please try again." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
