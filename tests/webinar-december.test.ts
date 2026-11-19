import ICAL from "ical.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/webinar/calendar/route";
import { DECEMBER_WEBINAR, WEBINAR_SESSIONS, decemberCalendarLinks, decemberRegistrationEnabled, decemberRegistrationState, decemberSessionClosed, getDecemberSession, getDecemberZoomUrl } from "../lib/webinar-december";

afterEach(() => vi.unstubAllEnvs());
describe("December webinar session routing", () => {
  it("requires a real session and never guesses one", () => {
    expect(getDecemberSession(undefined)).toBeUndefined();
    expect(getDecemberSession("noon")).toBeUndefined();
    expect(getDecemberSession("1pm")?.startUtc).toBe("2026-12-09T13:00:00.000Z");
  });
  it("keeps evening registration available after the lunchtime session closes", () => {
    const lunchtime = Date.parse("2026-12-09T13:00:00Z");
    expect(decemberSessionClosed("1pm", lunchtime)).toBe(true);
    expect(decemberSessionClosed("7pm", lunchtime)).toBe(false);
  });
  it("keeps review, closed and unavailable states distinct at the event boundary", () => {
    const start = Date.parse("2026-12-09T13:00:00Z");
    expect(decemberRegistrationState(false, "form", "1pm", start)).toBe("preview");
    expect(decemberRegistrationState(true, "form", "1pm", start - 1)).toBe("open");
    expect(decemberRegistrationState(true, "form", "1pm", start)).toBe("closed");
    expect(decemberRegistrationState(true, "", "7pm", start)).toBe("unavailable");
    expect(decemberRegistrationState(true, "form", "7pm", start)).toBe("open");
  });
  it("defaults registration off and requires exact launch switch", () => {
    vi.stubEnv("WEBINAR_DEC_2026_REGISTRATION_ENABLED", undefined);
    expect(decemberRegistrationEnabled()).toBe(false);
    vi.stubEnv("WEBINAR_DEC_2026_REGISTRATION_ENABLED", "false");
    expect(decemberRegistrationEnabled()).toBe(false);
    vi.stubEnv("WEBINAR_DEC_2026_REGISTRATION_ENABLED", "true");
    expect(decemberRegistrationEnabled()).toBe(true);
  });
  it("uses only the chosen session's configured Zoom room and rejects unsafe links", () => {
    vi.stubEnv("WEBINAR_DEC_2026_1PM_ZOOM_URL", "https://us06web.zoom.us/j/123");
    vi.stubEnv("WEBINAR_DEC_2026_7PM_ZOOM_URL", undefined);
    expect(getDecemberZoomUrl("1pm")).toBe("https://us06web.zoom.us/j/123");
    expect(getDecemberZoomUrl("7pm")).toBeNull();
    vi.stubEnv("WEBINAR_DEC_2026_1PM_ZOOM_URL", "https://zoom.us.evil.example/j/123");
    expect(getDecemberZoomUrl("1pm")).toBeNull();
  });
});
describe("December calendars", () => {
  for (const session of WEBINAR_SESSIONS) it(`creates the ${session.id} event with session-specific joining link`, async () => {
    const response = GET(new Request(`https://constructionbusinessblueprint.co.uk/api/webinar/calendar?session=${session.id}`));
    const ics = await response.text();
    const component = new ICAL.Component(ICAL.parse(ics));
    const event = new ICAL.Event(component.getFirstSubcomponent("vevent")!);
    expect(event.summary).toBe(DECEMBER_WEBINAR.title);
    expect(event.startDate.toJSDate().toISOString()).toBe(session.startUtc);
    expect(event.endDate.toJSDate().toISOString()).toBe(session.endUtc);
    expect(event.uid).toContain(`-${session.id}@`);
    expect(event.description).toContain(`/webinar/join?session=${session.id}`);
    expect(ics.split("\r\n").every(line => Buffer.byteLength(line) <= 75)).toBe(true);
    const links = decemberCalendarLinks(session.id, "https://constructionbusinessblueprint.co.uk");
    expect(new URL(links.google).searchParams.get("ctz")).toBe("Europe/London");
    expect(new URL(links.outlook).searchParams.get("startdt")).toBe(session.startUtc);
  });
  it("rejects an invalid explicit session instead of returning an old event", () => {
    expect(GET(new Request("https://example.com/api/webinar/calendar?session=invalid")).status).toBe(400);
  });
});
