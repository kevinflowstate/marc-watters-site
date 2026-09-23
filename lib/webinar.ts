export const WEBINAR = {
  id: "chaos-to-control-2026-10-15",
  title: "From Chaos To Control",
  subtitle: "The shift from tradesman to business owner",
  dateLabel: "Thursday 15 October 2026",
  shortDateLabel: "Thu 15 October",
  timeLabel: "7:00pm UK & Ireland",
  timezone: "Europe/London",
  startUtc: "2026-10-15T18:00:00.000Z",
  endUtc: "2026-10-15T19:00:00.000Z",
  createdUtc: "2026-09-20T16:00:00.000Z",
  source: "organic_webinar_lp",
  consentVersion: "2026-09-20-v2",
  emailConsentText: "I agree to receive my webinar confirmation, joining instructions, reminders and event replay/follow-up by email from Marc Watters.",
  whatsappConsentText: "Also send my webinar confirmation, reminders and event replay/follow-up by WhatsApp. I can opt out at any time.",
} as const;

export const WEBINAR_BOOKING_PATH = "/book-marc";
export const WEBINAR_JOIN_PATH = "/webinar/join";
export const WEBINAR_THANK_YOU_PATH = "/webinar/thank-you";
export const WEBINAR_CALENDAR_URL = "https://events.flowsite.pro/e/chaos-to-control-15-october-2026";

export const GHL_WEBINAR_FORM = {
  id: "p92tiX5kaTcA1ewFnzvu",
  name: "October Webinar Form — From Chaos To Control",
  embedOrigin: "https://link.constructionbusinessblueprint.co.uk",
  height: 395,
} as const;

export function webinarRegistrationClosed(nowMs = Date.now()) {
  return nowMs >= Date.parse(WEBINAR.startUtc);
}
