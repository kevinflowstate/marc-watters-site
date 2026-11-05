import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readDriveContentPack } from "../lib/ops/content-drive";
import { CBB_LOCATION_ID } from "../lib/ops/content-pack";

const fileId = "drive-manifest-123";
const manifest = {
  schema_version: 1,
  pack_id: "pack-1",
  version: 1,
  timezone: "Europe/London",
  location_id: CBB_LOCATION_ID,
  source: { provider: "google_drive", id: "brief-123", revision: "brief-v1" },
  posts: [
    {
      post_id: "post-1",
      platform: "facebook",
      account_id: "account-1",
      caption: "Useful business advice",
      schedule_at: "2030-01-07T10:00:00Z",
      media: [
        {
          asset_id: "asset-1",
          sha256: "a".repeat(64),
          url: "https://assets.example.com/" + "a".repeat(64) + ".png",
          mime_type: "image/png",
        },
      ],
    },
  ],
};
const text = JSON.stringify(manifest),
  sha = createHash("sha256").update(text).digest("hex");
const input = { fileId, expectedVersion: "7", expectedSha256: sha };
function drive(
  options: {
    changedVersion?: boolean;
    googleDoc?: boolean;
    changedBytes?: boolean;
    tooLarge?: boolean;
  } = {},
) {
  let meta = 0;
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(
      String(url).startsWith(
        `https://www.googleapis.com/drive/v3/files/${fileId}?`,
      ),
    ).toBe(true);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-drive-token",
    );
    expect(init?.redirect).toBe("error");
    if (String(url).endsWith("alt=media"))
      return new Response(options.changedBytes ? "{}" : text);
    meta++;
    return Response.json({
      id: fileId,
      mimeType: options.googleDoc
        ? "application/vnd.google-apps.document"
        : "application/json",
      version: options.changedVersion && meta > 1 ? "8" : "7",
      size: options.tooLarge ? 600_000 : text.length,
      trashed: false,
      capabilities: { canDownload: true },
    });
  });
}
describe("pinned Drive content manifest import", () => {
  it("reads metadata, verifies bounded bytes/hash and rechecks the same version", async () => {
    const fetch = drive();
    const r = await readDriveContentPack(input, {
      accessToken: "test-drive-token",
      fetch,
      now: new Date("2030-01-06T10:00:00Z"),
    });
    expect(r.pack).toEqual(manifest);
    expect(r.source).toEqual({ file_id: fileId, version: "7", sha256: sha });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([
    { changedVersion: true },
    { googleDoc: true },
    { changedBytes: true },
    { tooLarge: true },
  ])("refuses a changed or unsuitable source %j", async (options) => {
    await expect(
      readDriveContentPack(input, {
        accessToken: "test-drive-token",
        fetch: drive(options),
        now: new Date("2030-01-06T10:00:00Z"),
      }),
    ).rejects.toThrow();
  });
  it("requires explicit scoped access and an exact source pin before requests", async () => {
    const fetch = drive();
    await expect(readDriveContentPack(input, { fetch })).rejects.toThrow(
      "not configured",
    );
    await expect(
      readDriveContentPack(
        { ...input, fileId: "../other" },
        { accessToken: "test-drive-token", fetch },
      ),
    ).rejects.toThrow("Pinned");
    expect(fetch).not.toHaveBeenCalled();
  });
});
