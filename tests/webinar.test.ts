import assert from "node:assert/strict";
import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { GET as calendarGet } from "../app/api/webinar/calendar/route";
import { WEBINAR, webinarRegistrationClosed } from "../lib/webinar";

describe("native GHL webinar registration", () => {
  it("closes the landing-page registration gate at the event start", () => {
    expect(webinarRegistrationClosed(Date.parse(WEBINAR.startUtc) - 1)).toBe(false);
    expect(webinarRegistrationClosed(Date.parse(WEBINAR.startUtc))).toBe(true);
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
