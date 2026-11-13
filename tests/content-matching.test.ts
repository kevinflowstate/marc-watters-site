import { describe, it, expect } from "vitest";
import {
  monthFolder,
  currentMonthFolders,
  matchCaptions,
  replacementAction,
} from "../lib/content/matching";
import type { DriveFile } from "../lib/content/types";
const file = (name: string, id = name, monthId = "nov"): DriveFile => ({
  id,
  name,
  mimeType: "video/mp4",
  parent: "content",
  path: ["November 2026", "content", name],
  monthId,
  md5Checksum: "new",
});
describe("month discovery", () => {
  it.each([
    "November 2026",
    "Nov 26",
    "2026-11",
    "11 November",
    "11. November 2026",
    "November",
    "11_2026",
  ])("recognises %s", (s) => expect(monthFolder(s, 2026, 11)).toBe(true));
  it.each([
    "November 2025",
    "Nov 25",
    "2025-11",
    "October 2026",
    "2026-12",
    "September 2026",
  ])("rejects %s", (s) => expect(monthFolder(s, 2026, 11)).toBe(false));
  it("selects current and next across year rollover", () => {
    const folders = [
      "November 2026",
      "Dec 26",
      "January 2027",
      "January 2026",
    ].map((n) => ({
      ...file(n),
      mimeType: "application/vnd.google-apps.folder",
    }));
    expect(
      currentMonthFolders(folders, new Date("2026-12-20Z")).map((f) => f.name),
    ).toEqual(["Dec 26", "January 2027"]);
  });
});
describe("caption matching", () => {
  const videos = [
    file("01 Know your numbers.mp4"),
    file("02 Price for profit.mp4"),
  ];
  it("matches a Doc or txt basename and preserves Unicode caption text", () => {
    const result = matchCaptions(videos, [
      {
        id: "a",
        monthId: "nov",
        name: "01 Know your numbers.txt",
        text: "𝗧𝗶𝘁𝗹𝗲\nBody",
      },
    ]);
    expect(result.matches.get(videos[0].id)).toBe("𝗧𝗶𝘁𝗹𝗲\nBody");
    expect(result.matches.has(videos[1].id)).toBe(false);
  });
  it("matches combined captions labelled by number or full filename", () => {
    const r = matchCaptions(videos, [
      {
        id: "a",
        monthId: "nov",
        name: "Captions",
        text: "Video 1\nFirst caption\n\n02 Price for profit:\nSecond caption",
      },
    ]);
    expect([...r.matches.values()]).toEqual([
      "First caption",
      "Second caption",
    ]);
    expect(r.warnings).toEqual([]);
  });
  it("warns about unmatched captions and refuses ambiguous or cross-month matches", () => {
    const r = matchCaptions(
      [...videos, file("01 Other.mp4")],
      [
        {
          id: "a",
          monthId: "nov",
          name: "Captions",
          text: "Video 1\nAmbiguous\nVideo 9\nUnmatched",
        },
      ],
    );
    expect(r.matches.size).toBe(0);
    expect(r.warnings).toHaveLength(2);
    expect(
      matchCaptions(videos, [
        {
          id: "b",
          monthId: "dec",
          name: "01 Know your numbers",
          text: "Wrong month",
        },
      ]).matches.size,
    ).toBe(0);
  });
  it("does not silently choose duplicate captions", () =>
    expect(
      matchCaptions(
        videos,
        [1, 2].map((i) => ({
          id: String(i),
          monthId: "nov",
          name: "01 Know your numbers",
          text: "Caption",
        })),
      ).matches.size,
    ).toBe(0));
});
describe("file deduplication and replacement", () => {
  it("uses ID lookup and checksum rather than a filename to identify a replacement", () => {
    expect(replacementAction(undefined, file("one"))).toBe("new");
    expect(
      replacementAction(
        { drive_md5: "new", status: "ready", approved_at: null },
        file("renamed"),
      ),
    ).toBe("unchanged");
    expect(
      replacementAction(
        { drive_md5: "old", status: "ready", approved_at: null },
        file("one"),
      ),
    ).toBe("replaced");
  });
  it.each(["scheduled", "partly_scheduled", "importing", "skipped"] as const)(
    "protects %s",
    (status) =>
      expect(
        replacementAction(
          { drive_md5: "old", status, approved_at: null },
          file("one"),
        ),
      ).toBe("protected"),
  );
  it("protects any frozen approval even if the process died before final status", () =>
    expect(
      replacementAction(
        { drive_md5: "old", status: "ready", approved_at: "2026-11-13Z" },
        file("one"),
      ),
    ).toBe("protected"));
});
