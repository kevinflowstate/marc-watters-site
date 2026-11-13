import { afterEach, describe, expect, it, vi } from "vitest";
const connect = vi.hoisted(() => vi.fn());
vi.mock("../lib/ops/drive-connection", () => ({
  connectContentDrive: connect,
}));
import { walkInbox } from "../lib/content/drive";
const folder = "application/vnd.google-apps.folder";
const tree: Record<string, object[]> = {
  root123456789: [
    { id: "nov", name: "November 2026", mimeType: folder },
    { id: "dec", name: "2026-12", mimeType: folder },
    { id: "oct", name: "October 2026", mimeType: folder },
  ],
  nov: [
    { id: "content", name: "Content", mimeType: folder },
    { id: "captions", name: "Captions", mimeType: folder },
  ],
  content: [{ id: "nested", name: "Final edits", mimeType: folder }],
  nested: [{ id: "video", name: "01.mp4", mimeType: "video/mp4" }],
  captions: [
    {
      id: "doc",
      name: "Captions",
      mimeType: "application/vnd.google-apps.document",
    },
  ],
  dec: [],
  oct: [{ id: "old-video", name: "old.mp4", mimeType: "video/mp4" }],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function setup() {
  vi.stubEnv("OPS_CONTENT_INBOX_FOLDER_ID", " root123456789 ");
  connect.mockResolvedValue({ accessToken: "test-token" });
  const parents: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      expect(u.searchParams.has("alt")).toBe(false);
      expect(u.pathname.endsWith("/export")).toBe(false);
      const parent = u.searchParams.get("q")!.match(/^'([^']+)'/)![1];
      parents.push(parent);
      return Response.json({ files: tree[parent] ?? [] });
    }),
  );
  return parents;
}
describe("read-only Drive walking", () => {
  it("finds video at arbitrary depth while leaving old months unread", async () => {
    const parents = setup();
    const r = await walkInbox("intake", new Date("2026-11-13Z"));
    expect(parents).not.toContain("oct");
    expect(r.files.find((f) => f.id === "video")?.path).toEqual([
      "November 2026",
      "Content",
      "Final edits",
      "01.mp4",
    ]);
    expect(r.files.find((f) => f.id === "video")?.monthId).toBe("nov");
    expect(connect).toHaveBeenCalledWith({
      allowedFileIds: ["root123456789"],
      access: "read",
    });
  });
  it("maps the full tree with metadata calls only", async () => {
    const parents = setup();
    const r = await walkInbox("map");
    expect(parents).toContain("oct");
    expect(r.files.some((f) => f.id === "old-video")).toBe(true);
  });
  it("shows an unconnected folder without contacting Google", async () => {
    vi.stubEnv("OPS_CONTENT_INBOX_FOLDER_ID", " ");
    expect((await walkInbox("map")).configured).toBe(false);
    expect(connect).not.toHaveBeenCalled();
  });
});
