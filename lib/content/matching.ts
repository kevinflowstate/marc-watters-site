import type { DriveFile, Video } from "./types";
import { londonDate } from "./slots";
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function monthFolder(name: string, year: number, month: number) {
  const tokens = name
    .toLowerCase()
    .replace(/[._/\-]+/g, " ")
    .trim()
    .split(/\s+/);
  const word = tokens.find((t) =>
    months.some(
      (m) =>
        t === m || t === m.slice(0, 3) || (m === "september" && t === "sept"),
    ),
  );
  if (word) {
    if (!months[month - 1].startsWith(word)) return false;
    const years = tokens.filter(
      (t) => /^\d{4}$/.test(t) || (/^\d{2}$/.test(t) && Number(t) > 12),
    );
    return years.every((t) => Number(t) === year || Number(t) === year % 100);
  }
  if (tokens.length !== 2) return false;
  return (
    (Number(tokens[0]) === year && Number(tokens[1]) === month) ||
    (Number(tokens[1]) === year && Number(tokens[0]) === month) ||
    (Number(tokens[1]) === year % 100 && Number(tokens[0]) === month)
  );
}
export function currentMonthFolders(files: DriveFile[], now = new Date()) {
  const [year, month] = londonDate(now).split("-").map(Number);
  return files.filter(
    (f) =>
      f.mimeType === "application/vnd.google-apps.folder" &&
      (monthFolder(f.name, year, month) ||
        monthFolder(
          f.name,
          month === 12 ? year + 1 : year,
          month === 12 ? 1 : month + 1,
        )),
  );
}
export function replacementAction(
  existing: Pick<Video, "drive_md5" | "approved_at" | "status"> | undefined,
  file: DriveFile,
) {
  if (!existing) return "new";
  if (!file.md5Checksum || file.md5Checksum === existing.drive_md5)
    return "unchanged";
  if (
    existing.approved_at ||
    ["scheduled", "partly_scheduled", "importing", "skipped"].includes(
      existing.status,
    )
  )
    return "protected";
  return "replaced";
}
const base = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/\.(mp4|mov|webm|m4v|txt|docx?)$/i, "")
    .replace(/\s+caption(s)?$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const number = (s: string) =>
  base(s).match(/^(?:(?:video|reel|clip)\s*)?0*(\d+)(?:\s|$)/)?.[1];
export type CaptionDocument = {
  id: string;
  name: string;
  text: string;
  monthId: string;
};
/** Exact basenames win. Number labels only match a unique video in that month. */
export function matchCaptions(videos: DriveFile[], docs: CaptionDocument[]) {
  const matches = new Map<string, string>();
  const warnings: string[] = [];
  const candidates = new Map<string, string[]>();
  const add = (video: DriveFile, text: string) => {
    if (text.trim())
      candidates.set(video.id, [
        ...(candidates.get(video.id) ?? []),
        text.trim(),
      ]);
  };
  for (const doc of docs) {
    const inMonth = videos.filter((v) => v.monthId === doc.monthId);
    const exact = inMonth.filter((v) => base(v.name) === base(doc.name));
    if (exact.length === 1) {
      add(exact[0], doc.text);
      continue;
    }
    let label: string | null = null,
      body: string[] = [],
      found = false;
    const flush = () => {
      if (label === null) return;
      const named = inMonth.filter((v) => base(v.name) === base(label!));
      const numbered = number(label)
        ? inMonth.filter((v) => number(v.name) === number(label!))
        : [];
      const target = named.length ? named : numbered;
      if (target.length === 1 && body.join("\n").trim()) {
        add(target[0], body.join("\n"));
        found = true;
      } else warnings.push(`Unmatched caption: ${doc.name} · ${label}`);
    };
    for (const line of doc.text.split(/\r?\n/)) {
      const clean = line
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/\*\*/g, "")
        .trim();
      const explicit =
        clean.match(/^(?:video|reel|clip)\s*#?\s*\d+(?:\s*[-:–].*)?$/i) ||
        clean.match(/^\d+[.):]?$/);
      const heading = clean.replace(/:\s*$/, "").replace(/^\[|\]$/g, "");
      const named = inMonth.some((v) => base(v.name) === base(heading));
      if (explicit || named) {
        flush();
        label = heading;
        body = [];
      } else body.push(line);
    }
    flush();
    if (!found && label === null)
      warnings.push(`Unmatched caption: ${doc.name}`);
  }
  for (const [id, texts] of candidates) {
    if (texts.length === 1) matches.set(id, texts[0]);
    else
      warnings.push(
        `Multiple captions match ${videos.find((v) => v.id === id)?.name}; choose the caption manually`,
      );
  }
  return { matches, warnings };
}
