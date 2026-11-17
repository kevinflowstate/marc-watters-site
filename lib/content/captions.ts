// Captions from Killen Studios' caption docs. Pure functions: no database, no network.
//
// Their Drive layout (checked 17 Nov 2026): "<Mon> Content <YYYY>" > "Video Content" > "EP 61" > clips,
// and "<Mon> Content <YYYY>" > "Caption Doc" > "MW Short Captions - YT Video 61.pdf", whose sections
// are headed "Clip 1 – Title". So a doc belongs to one episode, and a clip number only means something
// inside that episode.

export type CaptionClip = { number: number; title: string; caption: string };
export type CaptionDoc = { id: string; name: string; monthId: string; episode: number | null; clips: CaptionClip[] };
export type VideoPlace = { id: string; name: string; path: string[]; monthId?: string | null };
export type CaptionOption = { key: string; label: string; title: string; caption: string };

const clean = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/\.(mp4|mov|webm|m4v|pdf|txt|docx?)$/i, "")
    .replace(/[_]+/g, " ")
    .trim();

/** "MW Short Captions - YT Video 61" -> 61. "EP 61" -> 61. */
export function docEpisode(name: string): number | null {
  const m = clean(name).match(/\b(?:video|vid|ep|episode)\s*\.?\s*#?\s*0*(\d{1,4})\b/i);
  return m ? Number(m[1]) : null;
}

/** The episode folder a video sits in: a path segment that is only "EP 61", "Episode 61" or "Video 46". */
export function videoEpisode(path: string[]): number | null {
  // path holds the folder names from the month folder down, then the file name last.
  for (const segment of path.slice(0, -1).reverse()) {
    const m = clean(segment).match(/^(?:ep|episode|video|vid)\s*\.?\s*#?\s*0*(\d{1,4})$/i);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * The clip number a file name states: "Video 01", "Clip 3", "Reel 2", or a leading "01 - ...".
 * "Shorts_1_edited" does not count: Killen's EP 60 shows "Shorts_1" is not Clip 1.
 */
export function clipNumber(fileName: string): number | null {
  const m = clean(fileName).match(/^(?:(?:video|clip|reel)\s*#?\s*)?0*(\d{1,3})(?:\s|$|[-–.:)])/i);
  return m ? Number(m[1]) : null;
}

const BOLD_UPPER = 0x1d5d4 - 0x41; // Mathematical sans-serif bold A
const BOLD_LOWER = 0x1d5ee - 0x61; // ... a
const BOLD_DIGIT = 0x1d7ec - 0x30; // ... 0

/** Marc's posted reels open with the title in bold (Unicode sans-serif bold), as in his live captions. */
export function boldTitle(title: string) {
  return Array.from(title)
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 0x41 && c <= 0x5a) return String.fromCodePoint(c + BOLD_UPPER);
      if (c >= 0x61 && c <= 0x7a) return String.fromCodePoint(c + BOLD_LOWER);
      if (c >= 0x30 && c <= 0x39) return String.fromCodePoint(c + BOLD_DIGIT);
      return ch;
    })
    .join("");
}

export function captionText(clip: Pick<CaptionClip, "title" | "caption">) {
  const title = clip.title.trim();
  const body = clip.caption.trim();
  return title ? `${boldTitle(title)}\n\n${body}` : body;
}

function docsFor(video: VideoPlace, docs: CaptionDoc[]) {
  const month = docs.filter((d) => video.monthId && d.monthId === video.monthId);
  const episode = videoEpisode(video.path);
  if (episode === null) return month;
  const same = month.filter((d) => d.episode === episode);
  return same.length ? same : month;
}

/** Every clip a reviewer could pick for this video: its own episode's doc, or the month's docs. */
export function captionOptions(video: VideoPlace, docs: CaptionDoc[]): CaptionOption[] {
  return docsFor(video, docs).flatMap((d) =>
    d.clips.map((c) => ({
      key: `${d.id}:${c.number}`,
      label: `${d.episode !== null ? `Video ${d.episode} · ` : ""}Clip ${c.number} – ${c.title}`,
      title: c.title,
      caption: captionText(c),
    })),
  );
}

/**
 * Automatic matches: only when the video sits in an episode folder, a doc exists for exactly that
 * episode, and the file name states a clip number with exactly one clip of that number in the doc.
 * Anything less certain is left for the reviewer to pick.
 */
export function matchClips(videos: VideoPlace[], docs: CaptionDoc[]) {
  const matches = new Map<string, { title: string; caption: string }>();
  for (const video of videos) {
    const episode = videoEpisode(video.path);
    const n = clipNumber(video.name);
    if (episode === null || n === null) continue;
    const epDocs = docs.filter((d) => d.monthId === video.monthId && d.episode === episode);
    if (epDocs.length !== 1) continue;
    const clips = epDocs[0].clips.filter((c) => c.number === n);
    if (clips.length !== 1) continue;
    matches.set(video.id, { title: clips[0].title, caption: captionText(clips[0]) });
  }
  return matches;
}

/** Validates the model's JSON: numbered clips with a title and a caption. Throws on anything else. */
export function parseClips(text: string): CaptionClip[] {
  const raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as { clips?: unknown };
  if (!Array.isArray(raw.clips)) throw new Error("caption_doc_invalid");
  const clips = raw.clips.map((c) => {
    const o = c as Record<string, unknown>;
    const number = Number(o.number);
    const title = typeof o.title === "string" ? o.title.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    const caption = typeof o.caption === "string" ? o.caption.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000) : "";
    if (!Number.isInteger(number) || number < 1 || number > 99 || !caption) throw new Error("caption_doc_invalid");
    return { number, title, caption };
  });
  if (new Set(clips.map((c) => c.number)).size !== clips.length) throw new Error("caption_doc_duplicate_clip");
  return clips;
}

export const CAPTION_DOC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clips"],
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "title", "caption"],
        properties: {
          number: { type: "integer" },
          title: { type: "string" },
          caption: { type: "string" },
        },
      },
    },
  },
} as const;
