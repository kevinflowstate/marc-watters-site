import { describe, expect, it } from "vitest";
import {
  boldTitle,
  captionOptions,
  captionText,
  clipNumber,
  docEpisode,
  matchClips,
  parseClips,
  videoEpisode,
  type CaptionDoc,
} from "@/lib/content/captions";

// Killen Studios' real November 2026 layout (17 Nov).
const month = "nov-2026";
const v = (id: string, ep: string, name: string) => ({ id, name, path: ["Nov Content 2026", "Video Content", ep, name], monthId: month });
const ep60 = ["Shorts_edited.mp4", "Shorts_1_edited.mp4", "Shorts_2_edited.mp4", "Shorts_3_edited.mp4", "Shorts_4_edited.mp4"].map((n, i) => v(`a${i}`, "EP 60", n));
const ep61 = ["Video 01.mp4", "Video 02.mp4", "Video 03.mp4", "Video 04.mp4", "Video 05.mp4"].map((n, i) => v(`b${i}`, "EP 61", n));
const clips = (titles: string[]) => titles.map((title, i) => ({ number: i + 1, title, caption: `Caption for ${title}\n\n#ConstructionBusiness` }));
const docs: CaptionDoc[] = [
  { id: "d60", name: "MW Short Captions - YT Video 60.pdf", monthId: month, episode: 60, clips: clips(["Being Successful Shouldn’t Consume Your Life", "Turnover Up, But Your Life Got Worse?", "C3", "C4", "C5"]) },
  { id: "d61", name: "MW Short Captions - YT Video 61.pdf", monthId: month, episode: 61, clips: clips(["If the Profit Isn’t in the Bank, It Didn’t Exist", "The Money in Your Bank Account Isn’t All Yours", "D3", "D4", "D5"]) },
];

describe("names", () => {
  it("reads the episode from a caption doc name and from an episode folder", () => {
    expect(docEpisode("MW Short Captions - YT Video 61.pdf")).toBe(61);
    expect(docEpisode("EP 07 captions.pdf")).toBe(7);
    expect(docEpisode("Captions.pdf")).toBeNull();
    expect(videoEpisode(["Nov Content 2026", "Video Content", "EP 61", "Video 01.mp4"])).toBe(61);
    expect(videoEpisode(["Aug Content 2026", "Video Content", "Video 46", "Boost Revenue.mp4"])).toBe(46);
    expect(videoEpisode(["Nov Content 2026", "Video Content", "Video 01.mp4"])).toBeNull();
  });
  it("only trusts file names that state a clip number", () => {
    expect(clipNumber("Video 01.mp4")).toBe(1);
    expect(clipNumber("Clip 3.mp4")).toBe(3);
    expect(clipNumber("02 — Success should not consume your life.mp4")).toBe(2);
    expect(clipNumber("Shorts_1_edited.mp4")).toBeNull();
    expect(clipNumber("Shorts_edited.mp4")).toBeNull();
    expect(clipNumber("Clip 2. Vanity Metrics Ruining Your Trade Business_ Real Profit Secrets.mp4")).toBe(2);
  });
});

describe("matching", () => {
  it("fills EP 61 from the Video 61 doc, clip for clip, and never from Video 60", () => {
    const m = matchClips([...ep60, ...ep61], docs);
    expect(m.get("b0")?.title).toBe("If the Profit Isn’t in the Bank, It Didn’t Exist");
    expect(m.get("b1")?.title).toBe("The Money in Your Bank Account Isn’t All Yours");
    expect(m.size).toBe(5);
  });
  it("leaves EP 60's Shorts files for the reviewer, because their names do not say which clip", () => {
    const m = matchClips(ep60, docs);
    expect(m.size).toBe(0);
  });
  it("offers only the same episode's clips in the picker", () => {
    const options = captionOptions(ep60[1], docs);
    expect(options).toHaveLength(5);
    expect(options[1].label).toBe("Video 60 · Clip 2 – Turnover Up, But Your Life Got Worse?");
    expect(options.every((o) => o.key.startsWith("d60:"))).toBe(true);
  });
  it("offers the whole month when a video is not in an episode folder", () => {
    const loose = { id: "x", name: "Extra.mp4", path: ["Nov Content 2026", "Video Content", "Extra.mp4"], monthId: month };
    expect(captionOptions(loose, docs)).toHaveLength(10);
  });
  it("ignores docs from another month", () => {
    const other = { ...ep61[0], monthId: "oct-2026" };
    expect(matchClips([other], docs).size).toBe(0);
    expect(captionOptions(other, docs)).toHaveLength(0);
  });
});

describe("caption text", () => {
  it("opens with the title in bold, as on Marc's posted reels", () => {
    expect(boldTitle("Turnover Up, But")).toBe("𝗧𝘂𝗿𝗻𝗼𝘃𝗲𝗿 𝗨𝗽, 𝗕𝘂𝘁");
    expect(boldTitle("Shouldn’t 30%")).toBe("𝗦𝗵𝗼𝘂𝗹𝗱𝗻’𝘁 𝟯𝟬%");
    expect(captionText({ title: "Resilience", caption: "Body\n\n#Tag" })).toBe("𝗥𝗲𝘀𝗶𝗹𝗶𝗲𝗻𝗰𝗲\n\nBody\n\n#Tag");
  });
  it("accepts well-formed clips from the model and rejects anything else", () => {
    expect(parseClips('{"clips":[{"number":1,"title":" A  title ","caption":"Line\\n\\n\\n\\nNext"}]}')).toEqual([
      { number: 1, title: "A title", caption: "Line\n\nNext" },
    ]);
    expect(() => parseClips('{"clips":[{"number":1,"title":"A","caption":""}]}')).toThrow();
    expect(() => parseClips('{"clips":[{"number":1,"title":"A","caption":"x"},{"number":1,"title":"B","caption":"y"}]}')).toThrow();
    expect(() => parseClips("not json")).toThrow();
  });
});
