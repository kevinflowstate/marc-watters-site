import { describe, expect, it, vi } from "vitest";
import { writePortalSnapshot } from "../lib/ops/portal-snapshot";

const FILE = "snapshot-file-123456";
const OWNER = "mrwmanagement@outlook.com";
const connect = vi.fn(async (options: { allowedFileIds: string[]; access: "write" }) => {
  expect(options).toEqual({ allowedFileIds: [FILE], access: "write" });
  return { accessToken: "drive-write", allowedFileIds: [FILE], serviceAccountEmail: "r@x.iam.gserviceaccount.com" };
});
function drive(meta: Record<string, unknown>, uploadStatus = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    expect(init?.redirect).toBe("error");
    if (String(url).startsWith("https://www.googleapis.com/upload/"))
      return new Response("{}", { status: uploadStatus });
    return Response.json(meta);
  });
  return { fn, calls };
}
const goodMeta = {
  id: FILE,
  mimeType: "application/json",
  trashed: false,
  owners: [{ emailAddress: OWNER }],
  capabilities: { canEdit: true },
};

describe("portal snapshot for scheduled Codex runs", () => {
  it("is off until the file is configured", async () => {
    expect(await writePortalSnapshot({ fileId: "", ownerEmails: [OWNER], connect })).toEqual({
      configured: false,
      written: false,
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it("writes the snapshot to exactly the one checked file", async () => {
    const { fn, calls } = drive(goodMeta);
    const out = await writePortalSnapshot({
      fileId: FILE,
      ownerEmails: [OWNER],
      connect,
      fetch: fn,
      build: async () => ({ kind: "cbb_portal_snapshot", clients: [] }),
    });
    expect(out).toMatchObject({ configured: true, written: true });
    const upload = calls.find((c) => c.url.includes("/upload/"))!;
    expect(upload.url).toContain(`/files/${FILE}?uploadType=media`);
    expect(upload.init?.method).toBe("PATCH");
    expect(JSON.parse(String(upload.init?.body))).toEqual({ kind: "cbb_portal_snapshot", clients: [] });
  });

  it.each([
    ["another owner", { owners: [{ emailAddress: "someone@else.com" }] }],
    ["view-only share", { capabilities: { canEdit: false } }],
    ["not JSON", { mimeType: "application/vnd.google-apps.document" }],
    ["trashed", { trashed: true }],
    ["different file", { id: "other-file-123456" }],
  ])("refuses to write when the file is %s", async (_label, change) => {
    const build = vi.fn();
    const { fn, calls } = drive({ ...goodMeta, ...change });
    await expect(
      writePortalSnapshot({ fileId: FILE, ownerEmails: [OWNER], connect, fetch: fn, build }),
    ).rejects.toMatchObject({ status: 409 });
    expect(build).not.toHaveBeenCalled();
    expect(calls.some((c) => c.url.includes("/upload/"))).toBe(false);
  });

  it("reports a refused upload", async () => {
    const { fn } = drive(goodMeta, 403);
    await expect(
      writePortalSnapshot({ fileId: FILE, ownerEmails: [OWNER], connect, fetch: fn, build: async () => ({}) }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("refuses an oversized snapshot", async () => {
    const { fn } = drive(goodMeta);
    await expect(
      writePortalSnapshot({
        fileId: FILE,
        ownerEmails: [OWNER],
        connect,
        fetch: fn,
        build: async () => ({ blob: "x".repeat(950_000) }),
      }),
    ).rejects.toMatchObject({ status: 507 });
  });
});
