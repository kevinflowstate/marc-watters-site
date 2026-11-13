export const DECEMBER_WEBINAR = {
  id: "cbb-growth-engine-2026-12-09",
  title: "The CBB 2027 Growth Engine",
  siteUrl: "https://constructionbusinessblueprint.co.uk",
  dateLabel: "Wednesday 9 December 2026",
  shortDateLabel: "Wed 9 December",
  timezone: "Europe/London",
  timezoneLabel: "UK & Ireland time (GMT)",
  createdUtc: "2026-11-13T00:00:00.000Z",
} as const;

export const WEBINAR_SESSIONS = [
  { id: "1pm", time: "1:00pm", startUtc: "2026-12-09T13:00:00.000Z", endUtc: "2026-12-09T14:00:00.000Z", description: "Step off site or take an hour at lunch.", formId: "iu9RsWcRGM7mySXHf3CX", formEnv: "WEBINAR_DEC_2026_1PM_FORM_ID", zoomEnv: "WEBINAR_DEC_2026_1PM_ZOOM_URL" },
  { id: "7pm", time: "7:00pm", startUtc: "2026-12-09T19:00:00.000Z", endUtc: "2026-12-09T20:00:00.000Z", description: "Sit down once the tools are away.", formId: "k1wscSgf4tYMCjpxXI7U", formEnv: "WEBINAR_DEC_2026_7PM_FORM_ID", zoomEnv: "WEBINAR_DEC_2026_7PM_ZOOM_URL" },
] as const;

export type WebinarSessionId = typeof WEBINAR_SESSIONS[number]["id"];
export function getDecemberSession(value: unknown) {
  return WEBINAR_SESSIONS.find(session => session.id === value);
}
export function decemberSessionClosed(id: WebinarSessionId, now = Date.now()) {
  return now >= Date.parse(getDecemberSession(id)!.startUtc);
}
export function decemberRegistrationEnabled() {
  return process.env.WEBINAR_DEC_2026_REGISTRATION_ENABLED === "true";
}
export function getDecemberZoomUrl(id: WebinarSessionId) {
  const value = process.env[getDecemberSession(id)!.zoomEnv]?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)zoom\.us$/.test(url.hostname) ? url.toString() : null;
  } catch { return null; }
}
export function decemberJoinPath(id: WebinarSessionId) {
  return `/webinar/join?session=${id}`;
}
export function decemberCalendarPath(id: WebinarSessionId) {
  return `/api/webinar/calendar?session=${id}`;
}
export function decemberCalendarLinks(id: WebinarSessionId, siteUrl: string) {
  const session = getDecemberSession(id)!;
  const join = `${siteUrl.replace(/\/$/, "")}${decemberJoinPath(id)}`;
  const description = `Free live workshop with Marc Watters. Bring a pen, paper and your biggest question. Join: ${join}`;
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({ action: "TEMPLATE", text: DECEMBER_WEBINAR.title, dates: `${session.startUtc.replace(/[-:]/g, "").replace(".000", "")}/${session.endUtc.replace(/[-:]/g, "").replace(".000", "")}`, ctz: DECEMBER_WEBINAR.timezone, details: description, location: join }).toString();
  const outlook = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlook.search = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: DECEMBER_WEBINAR.title, startdt: session.startUtc, enddt: session.endUtc, body: description, location: join }).toString();
  return { google: google.toString(), outlook: outlook.toString(), apple: decemberCalendarPath(id) };
}

export function decemberRegistrationState(enabled: boolean, formId: string, session: WebinarSessionId, now = Date.now()) {
  if (!enabled) return "preview" as const;
  if (decemberSessionClosed(session, now)) return "closed" as const;
  if (!formId) return "unavailable" as const;
  return "open" as const;
}
