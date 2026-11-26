import { createAdminClient } from "@/lib/supabase/admin";
import { londonClock } from "./job-health";
import { queueLessonEdit } from "./lesson-edit-plan";
import { lessonEditorialSource } from "./lesson-source";
import { OpsError } from "./tasks";

type Line = { at: number; speaker: string; text: string };
type Span = [number, number];
const host = /^(?:marc|marc watters)$/i;
const breakCue =
  /(?:set (?:a|the) (?:timer|tunes)|(?:take|give you|give everybody|take another) (?:some time|a (?:couple of |few )?minutes?|(?:two|three|five|ten|\d+) minutes)|still writing|keep writing|work (?:through|on) (?:that|this) for|follow along on the screen)/i;
const openingCue =
  /(?:tonight(?:'s| is| we(?:'re| are| will))|today we(?:'re| are| will)|(?:topic|subject) (?:is|for)|let(?:'s| us) (?:begin|start) with)/i;
const closingCue =
  /(?:before we (?:shut off|sign off|wrap up)|(?:see|catch) (?:you|everybody) (?:all )?next week|that(?:'s| is) (?:us|all) for (?:today|tonight))/i;
const privateTopic =
  /(?:https?:|@|£|€|\$|\b(?:next steps|live event|attendee|client spotlight|personal update|next week|housekeeping|logistics)\b)/i;

export function fallbackDue(now: Date) {
  const clock = londonClock(now);
  return (
    clock.day === "Wed" ||
    (clock.day === "Tue" && clock.minutes >= 21 * 60 + 10)
  );
}

function transcriptLines(raw: unknown): Line[] {
  if (!Array.isArray(raw) || !raw.length)
    throw new OpsError("Fathom transcript is not ready", 503);
  const lines: Line[] = [];
  for (const row of raw) {
    const match = /^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(
      row?.timestamp ?? "",
    );
    if (
      !match ||
      Number(match[2]) >= 60 ||
      Number(match[3]) >= 60 ||
      typeof row.text !== "string" ||
      typeof row.speaker?.display_name !== "string"
    )
      throw new OpsError("Unexpected Fathom transcript format", 409);
    const at =
      Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    if (at < (lines.at(-1)?.at ?? 0))
      throw new OpsError("Fathom timestamps are out of order", 409);
    lines.push({
      at,
      speaker: row.speaker.display_name.trim(),
      text: row.text.trim(),
    });
  }
  if (!lines.some((line) => host.test(line.speaker)))
    throw new OpsError(
      "Marc could not be identified in the coaching transcript",
      409,
    );
  return lines;
}

// A gap on its own is never evidence of a cut. Preserve uncertain speech and give
// the reviewer timestamps for participant exchanges the rules cannot classify.
export function makeFathomPlan(
  date: string,
  id: number,
  calendar: { title: string; hasPdf: boolean },
  transcript: unknown,
  summary: string,
) {
  const lines = transcriptLines(transcript);
  const last = lines.at(-1)!.at;
  // Fathom's meeting wall clock includes time outside its exported media.
  // Editorial timestamps use the transcript clock. The worker checks its end
  // against the measured MP4 duration before applying any cut.
  const duration = last;
  if (!(duration >= 1200 && duration <= 8 * 3600))
    throw new OpsError(
      "The Fathom transcript and recording timings differ",
      409,
    );
  const participantNames = [
    ...new Set(
      lines
        .filter((l) => !host.test(l.speaker))
        .map((l) => l.speaker.split(/\s+/)[0].toLowerCase()),
    ),
  ];
  const safe = (s: string) =>
    s &&
    !privateTopic.test(s) &&
    !s
      .split(/[^\p{L}]+/u)
      .some((word) => participantNames.includes(word.toLowerCase()));
  const plain = (s: string) =>
    s
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
  const headings = [...summary.matchAll(/^###\s+([^\n]+)$/gm)];
  const takeawayLabels = [...summary.matchAll(/^[ \t]*[-*] \[?\*\*([^*\n]{3,100}?):?\*\*/gm)];
  const topics = (headings.length ? headings : takeawayLabels)
    .map((m) => plain(m[1]).replace(/^workbook exercise:\s*/i, ""))
    .filter(safe)
    .slice(0, 6);
  const purpose = plain(
    summary.match(/^## Meeting Purpose\s*\n+([^\n]+)/im)?.[1] ?? "",
  ).replace(/[.!?]$/, "");
  const title =
    /^(?:tuesday(?: night)? (?:coaching )?call|group (?:coaching )?call)$/i.test(
      calendar.title,
    )
      ? topics[0]
      : calendar.title;
  if (!title || !topics.length)
    throw new OpsError(
      "Fathom has no usable teaching topics for the calendar lesson",
      409,
    );
  const first =
    /^to\s/i.test(purpose) && safe(purpose) && purpose.length < 250
      ? "You learned how to " + purpose.slice(3) + "."
      : "You worked through " + title + ".";
  const overview =
    first +
    " You explored " +
    new Intl.ListFormat("en-GB").format(
      topics.slice(0, 3).map((t) => "“" + t + "”"),
    ) +
    ".";
  const cuts: Span[] = [];
  const intro = lines.find(
    (l) => l.at < 360 && host.test(l.speaker) && openingCue.test(l.text),
  );
  if (intro && intro.at > 3) cuts.push([0, intro.at]);
  for (let i = 0; i + 1 < lines.length; i++) {
    const line = lines[i],
      next = lines[i + 1];
    const speechEnd =
      line.at + Math.max(3, Math.ceil(line.text.split(/\s+/).length / 1.8) + 1);
    if (next.at - speechEnd < 35) continue;
    let j = i;
    while (j >= 0 && line.at - lines[j].at <= 45) {
      const continuingBreak =
        cuts.length > 0 &&
        lines[j].at >= cuts[cuts.length - 1][1] &&
        lines[j].at - cuts[cuts.length - 1][1] < 15 &&
        /^(?:just )?keep going(?: guys| lads)?[.!]?$/i.test(lines[j].text);
      if (
        host.test(lines[j].speaker) &&
        (breakCue.test(lines[j].text) || continuingBreak)
      ) {
        cuts.push([speechEnd, next.at]);
        break;
      }
      j--;
    }
  }
  const end = lines.find(
    (l) =>
      l.at >= duration - 100 && host.test(l.speaker) && closingCue.test(l.text),
  );
  // Only cut a closing remark when no substantive reply follows it.
  if (
    end &&
    lines
      .filter((l) => l.at > end.at)
      .every(
        (l) =>
          l.text.split(/\s+/).length <= 12 &&
          /thank|cheers|bye|night|great|no questions/i.test(l.text),
      )
  )
    cuts.push([end.at, duration]);
  const keep: [number, number | null][] = [];
  let pos = 0;
  for (const [start, stop] of cuts) {
    if (start > pos) keep.push([pos, start]);
    pos = Math.max(pos, stop);
  }
  if (pos < duration) keep.push([pos, null]);
  const cutSeconds =
    duration - keep.reduce((sum, [a, b]) => sum + (b ?? duration) - a, 0);
  if (!keep.length || cutSeconds > duration * 0.6)
    throw new OpsError("Proposed recovery cut needs editorial review", 409);
  const stamp = (s: number) =>
    Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const guestTimes = lines
    .filter(
      (l, i) =>
        !host.test(l.speaker) && (!i || lines[i - 1].speaker !== l.speaker),
    )
    .map((l) => stamp(l.at));
  const note =
    "The scheduled chat handoff was unavailable. The portal used this recording’s Fathom transcript and meeting summary. " +
    (cutSeconds >= 180
      ? "Trimmed confirmed opening, closing or announced pause intervals: " +
        cuts.map(([a, b]) => stamp(a) + "–" + stamp(b)).join(", ") +
        ". "
      : "Confirmed cuts total under three minutes, so the original replay was retained. ") +
    "Review remaining setup, private examples and time-bound wording before approval." +
    (guestTimes.length
      ? " Participant exchanges to check: " +
        guestTimes.slice(0, 18).join(", ") +
        "."
      : "");
  return {
    kind: "lesson_edit",
    lesson_date: date,
    recording_id: id,
    title,
    summary_md: "**Here's what you learned**\n\n" + overview,
    review_note: note,
    transcript_end_s: last,
    keep_ranges: keep,
    ...(calendar.hasPdf
      ? {}
      : {
          workbook: {
            title,
            date_line: date,
            intro: overview,
            how_to_use: ["Work through each topic using your own business."],
            sections: topics
              .slice(0, 4)
              .map((topic) => ({
                title: topic.slice(0, 120),
                blocks: [
                  {
                    type: "write",
                    question:
                      "What will you put into practice from “" +
                      topic.slice(0, 120) +
                      "”, and what will you measure?",
                    lines: 4,
                  },
                ],
              })),
          },
        }),
  };
}

export async function queueFathomRecovery(
  date: string,
  recordingId: number,
) {
  const db = createAdminClient();
  const until = new Date(
    Date.parse(date + "T00:00:00Z") + 86400000,
  ).toISOString();
  const events = await db
    .from("calendar_events")
    .select("title,event_time,attachments")
    .eq("is_active", true)
    .gte("event_date", date + "T00:00:00Z")
    .lt("event_date", until);
  if (events.error)
    throw new OpsError("Could not read the lesson calendar", 503);
  const matching = (events.data ?? []).filter((e) =>
    /^(18|19|20):/.test(e.event_time ?? ""),
  );
  if (matching.length !== 1)
    throw new OpsError("Expected one matching evening coaching event", 409);
  const event = matching[0];
  const existing = await db
    .from("module_content")
    .select("title")
    .eq("module_id", "faa36657-fa83-4f66-87cb-cf597b3d75b2")
    .gte("created_at", date + "T00:00:00Z")
    .eq("title", event.title)
    .limit(1);
  if (existing.error || existing.data?.length)
    throw new OpsError(
      "Could not rule out an existing replay of this call",
      409,
    );
  const materials = await lessonEditorialSource(recordingId);
  const hasPdf =
    Array.isArray(event.attachments) &&
    event.attachments.some((f) => f?.type === "pdf" || /\.pdf$/i.test(f?.name));
  const plan = makeFathomPlan(
    date,
    recordingId,
    { title: event.title, hasPdf },
    materials.transcript,
    materials.summary,
  );
  await queueLessonEdit(plan, "CBB lesson edit " + date);
}
