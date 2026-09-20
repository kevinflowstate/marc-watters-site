import { NextResponse } from "next/server";
import { getSiteUrl } from "../../../../lib/site-url";
import { WEBINAR, WEBINAR_JOIN_PATH } from "../../../../lib/webinar";

function calendarEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line: string) {
  const folded: string[] = [];
  let current = "";
  for (const character of line) {
    const prefix = folded.length ? " " : "";
    if (Buffer.byteLength(prefix + current + character, "utf8") > 75) {
      folded.push(prefix + current);
      current = character;
    } else {
      current += character;
    }
  }
  folded.push((folded.length ? " " : "") + current);
  return folded;
}

export function GET() {
  const joinUrl = `${getSiteUrl()}${WEBINAR_JOIN_PATH}`;
  const description = "Live workshop with Marc Watters for trade and construction business owners. Open the joining page below when the workshop is due to start.";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Construction Business Blueprint//From Chaos To Control//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${WEBINAR.id}@constructionbusinessblueprint.co.uk`,
    `DTSTAMP:${icsUtc(WEBINAR.createdUtc)}`,
    `DTSTART:${icsUtc(WEBINAR.startUtc)}`,
    `DTEND:${icsUtc(WEBINAR.endUtc)}`,
    `SUMMARY:${calendarEscape(WEBINAR.title)}`,
    `DESCRIPTION:${calendarEscape(description)}\\n\\nJoin: ${calendarEscape(joinUrl)}`,
    `LOCATION:${calendarEscape("Live on Zoom")}`,
    `URL:${calendarEscape(joinUrl)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${calendarEscape(`${WEBINAR.title} starts in one hour`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].flatMap(foldIcsLine).join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="from-chaos-to-control.ics"',
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
