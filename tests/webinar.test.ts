import assert from "node:assert/strict";
import ICAL from "ical.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as calendarGet } from "../app/api/webinar/calendar/route";
import { POST as registerPost, registrationClosed } from "../app/api/webinar/register/route";
import { WEBINAR } from "../lib/webinar";

const LOCATION_ID = "93GJEdsr0cT9el3OINXq";
const WA_TAG = "webinar-2026-10-15-whatsapp-consent";
const EVENT_TAG = "webinar-2026-10-15";
const ORGANIC_TAG = "webinar-2026-10-15-organic";
const originalFetch = global.fetch;

beforeAll(() => {
  process.env.WEBINAR_REGISTRATION_ENABLED = "true";
  process.env.GHL_WEBINAR_LOCATION_TOKEN = "test-token";
});

afterAll(() => {
  global.fetch = originalFetch;
  delete process.env.WEBINAR_REGISTRATION_ENABLED;
  delete process.env.GHL_WEBINAR_LOCATION_TOKEN;
});

function registrationBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId: WEBINAR.id,
    firstName: "Kevin Test",
    email: "kevin-test@example.invalid",
    emailConsent: true,
    whatsappConsent: false,
    consentVersion: WEBINAR.consentVersion,
    source: WEBINAR.source,
    landingPage: "https://example.com/webinar?email=do-not-store&utm_source=newsletter",
    referrer: "https://social.example/post?contact=do-not-store",
    utm: { source: "newsletter", medium: "email", campaign: "october-webinar" },
    ...overrides,
  };
}

function request(body: unknown, ip: string) {
  return new NextRequest("http://localhost/api/webinar/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function ghlMock(options: { failTag?: boolean; corruptReadback?: boolean } = {}) {
  let tags: string[] = ["existing-unrelated-tag"];
  let customFields: Array<{ id: string; fieldValue: unknown }> = [];
  const calls: Array<{ method: string; url: string; body: unknown }> = [];

  global.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, url, body });

    if (url.endsWith("/contacts/upsert") && method === "POST") {
      customFields = body.customFields;
      return Response.json({ contact: { id: "contact-1", locationId: LOCATION_ID } });
    }
    if (url.endsWith("/contacts/contact-1/tags") && method === "POST") {
      if (options.failTag) return Response.json({ message: "failed" }, { status: 500 });
      tags = [...new Set([...tags, ...body.tags])];
      return Response.json({ tags }, { status: 201 });
    }
    if (url.endsWith("/contacts/contact-1/tags") && method === "DELETE") {
      tags = tags.filter((tag) => !body.tags.includes(tag));
      return Response.json({ tags });
    }
    if (url.endsWith("/contacts/contact-1") && method === "GET") {
      const savedFields = options.corruptReadback
        ? customFields.map((field) => field.id === "FX2CXYXn3Q1BuBaQNDVf" ? { ...field, fieldValue: "wrong-source" } : field)
        : customFields;
      return Response.json({ contact: { id: "contact-1", locationId: LOCATION_ID, tags, customFields: savedFields } });
    }
    throw new Error(`Unexpected GHL request: ${method} ${url}`);
  };

  return { calls, getTags: () => tags };
}

describe("webinar registration", () => {
  it("closes registration at the exact event start", () => {
    expect(registrationClosed(Date.parse(WEBINAR.startUtc) - 1)).toBe(false);
    expect(registrationClosed(Date.parse(WEBINAR.startUtc))).toBe(true);
  });

  it("rejects null bodies and local phone numbers before any upstream call", async () => {
    let upstreamCalls = 0;
    global.fetch = async () => {
      upstreamCalls += 1;
      throw new Error("should not be called");
    };

    const nullResponse = await registerPost(request(null, "test-null"));
    expect(nullResponse.status).toBe(400);

    const phoneResponse = await registerPost(request(registrationBody({ whatsappConsent: true, phone: "07700 900000" }), "test-phone"));
    expect(phoneResponse.status).toBe(400);
    const phoneBody = await phoneResponse.json();
    expect(phoneBody.fieldErrors.phone).toMatch(/country code/i);
    expect(upstreamCalls).toBe(0);
  });

  it("accepts email-only registration after durable GHL tag and field readback", async () => {
    const mock = ghlMock();
    const response = await registerPost(request(registrationBody(), "test-success"));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, redirect: "/webinar/thank-you" });
    expect(response.headers.get("set-cookie")).toContain("webinar_registration=");
    expect(mock.getTags()).toEqual(expect.arrayContaining([EVENT_TAG, ORGANIC_TAG, "existing-unrelated-tag"]));

    const upsertBody = mock.calls.find((call) => call.url.endsWith("/contacts/upsert"))?.body as { phone?: string; customFields: Array<{ id: string; fieldValue: string }> };
    expect(upsertBody.phone).toBeUndefined();
    const attribution = upsertBody.customFields.find((field) => field.id === "zHUstJ6GIcCTi5xLA1xL")?.fieldValue || "";
    expect(attribution).toContain("utm_source");
    expect(attribution).not.toContain("do-not-store");
  });

  it("fails closed when tags or saved custom fields cannot be verified", async () => {
    ghlMock({ failTag: true });
    const tagResponse = await registerPost(request(registrationBody(), "test-tag-failure"));
    expect(tagResponse.status).toBe(502);

    ghlMock({ corruptReadback: true });
    const readbackResponse = await registerPost(request(registrationBody(), "test-readback-failure"));
    expect(readbackResponse.status).toBe(502);
  });

  it("adds WhatsApp consent then removes only the event consent tag on re-registration", async () => {
    const mock = ghlMock();
    const optedIn = await registerPost(request(registrationBody({ whatsappConsent: true, phone: "+447700900000" }), "test-reentry-1"));
    expect(optedIn.status).toBe(201);
    expect(mock.getTags()).toContain(WA_TAG);

    const optedOut = await registerPost(request(registrationBody({ whatsappConsent: false, phone: "" }), "test-reentry-2"));
    expect(optedOut.status).toBe(201);
    expect(mock.getTags()).not.toContain(WA_TAG);
    expect(mock.getTags()).toContain("existing-unrelated-tag");
    expect(mock.calls.find((call) => call.method === "DELETE")?.body).toEqual({ tags: [WA_TAG] });
  });
});

describe("webinar calendar", () => {
  it("parses, derives event time, and folds every content line", async () => {
    const response = calendarGet();
    const ics = await response.text();
    for (const line of ics.split("\r\n")) {
      assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line exceeds 75 octets: ${line}`);
    }

    const component = new ICAL.Component(ICAL.parse(ics));
    const event = new ICAL.Event(component.getFirstSubcomponent("vevent"));
    expect(event.summary).toBe(WEBINAR.title);
    expect(event.startDate.toJSDate().toISOString()).toBe(WEBINAR.startUtc);
    expect(event.endDate.toJSDate().toISOString()).toBe(WEBINAR.endUtc);
    expect(event.location).toBe("Live on Zoom");
    expect(event.description).toMatch(/Join: https:\/\/marc-watters-site\.vercel\.app\/webinar\/join/);
  });
});
