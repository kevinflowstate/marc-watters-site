import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  DRIVE_RESULTS_ACTOR,
  importDriveResults,
} from "../lib/ops/drive-results";
import { OpsError } from "../lib/ops/tasks";

const FOLDER = "folder-abc-1234567890";
const OWNER = "marc@constructionbusinessblueprint.co.uk";
const NOW = new Date("2026-11-10T12:00:00Z");
const connect = vi.fn(async () => ({
  accessToken: "drive-access",
  allowedFileIds: [FOLDER],
  serviceAccountEmail: "reader@test.iam.gserviceaccount.com",
}));

const result = (run_key: string) => ({
  run_key,
  kind: "daily_brief",
  title: "Daily brief",
  summary: "Two things for Marc",
  body: "**Marc**\n- Friday clash",
  outcome: "complete",
  coverage: "Mailbox and calendar, last 24 hours",
  observed_at: "2026-11-10T08:39:00Z",
  links: [],
});

const md5 = (value: unknown) =>
  createHash("md5").update(JSON.stringify(value)).digest("hex");
let bodiesForMd5: Record<string, unknown> = {};
function driveFile(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `${id}.json`,
    mimeType: "application/json",
    modifiedTime: "2026-11-10T08:40:00Z",
    size: "400",
    owners: [{ emailAddress: OWNER }],
    lastModifyingUser: { emailAddress: OWNER },
    get md5Checksum() {
      return id in bodiesForMd5 ? md5(bodiesForMd5[id]) : "0".repeat(32);
    },
    capabilities: { canDownload: true, canEdit: false },
    ...extra,
  };
}

function fakeDrive(
  files: Record<string, unknown>[],
  bodies: Record<string, unknown>,
) {
  bodiesForMd5 = bodies;
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    expect(init?.redirect).toBe("error");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer drive-access",
    );
    if (href.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      const q = new URL(href).searchParams.get("q")!;
      expect(q).toContain(`'${FOLDER}' in parents`);
      expect(q).toContain("trashed = false");
      expect(q).toContain("modifiedTime > '2026-11-07T12:00:00.000Z'");
      return Response.json({ files });
    }
    const id = decodeURIComponent(
      href.split("/files/")[1].split("?")[0],
    );
    expect(href).toContain("alt=media");
    if (!(id in bodies)) return new Response("missing", { status: 404 });
    return new Response(JSON.stringify(bodies[id]));
  });
}

describe("Drive results handoff", () => {
  it("does nothing when the folder is not configured", async () => {
    const out = await importDriveResults({
      folderId: "",
      ownerEmails: [],
      connect,
    });
    expect(out).toMatchObject({ configured: false, files: 0, saved: 0 });
  });

  it("refuses half-configured or malformed settings", async () => {
    await expect(
      importDriveResults({ folderId: FOLDER, ownerEmails: [], connect }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      importDriveResults({ folderId: "bad id!", ownerEmails: [OWNER], connect }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("saves single results and arrays through the shared validator as one fixed actor", async () => {
    const submit = vi.fn(async (_doc: unknown, _actor: string) => ({ received_at: NOW.toISOString() }));
    const out = await importDriveResults({
      folderId: FOLDER,
      ownerEmails: [OWNER.toUpperCase()],
      now: NOW,
      connect,
      submit,
      fetch: fakeDrive([driveFile("file-one-123456"), driveFile("file-two-123456")], {
        "file-one-123456": result("daily:2026-11-10"),
        "file-two-123456": [result("sales:2026-11-09:a"), result("sales:2026-11-09:b")],
      }),
    });
    expect(out).toMatchObject({ configured: true, files: 2, saved: 3, invalid: 0 });
    expect(submit).toHaveBeenCalledTimes(3);
    for (const call of submit.mock.calls)
      expect(call[1]).toBe(DRIVE_RESULTS_ACTOR);
  });

  it("counts an already imported run key as unchanged, not new", async () => {
    const submit = vi.fn(async () => ({
      received_at: "2026-11-10T09:00:00Z",
    }));
    const out = await importDriveResults({
      folderId: FOLDER,
      ownerEmails: [OWNER],
      now: NOW,
      connect,
      submit,
      fetch: fakeDrive([driveFile("file-one-123456")], {
        "file-one-123456": result("daily:2026-11-10"),
      }),
    });
    expect(out).toMatchObject({ saved: 0, unchanged: 1 });
  });

  it("skips files from other owners, editable shares, oversized or empty files", async () => {
    const submit = vi.fn();
    const out = await importDriveResults({
      folderId: FOLDER,
      ownerEmails: [OWNER],
      now: NOW,
      connect,
      submit,
      fetch: fakeDrive(
        [
          driveFile("other-owner-12345", { owners: [{ emailAddress: "someone@else.com" }] }),
          driveFile("editable-123456", { capabilities: { canDownload: true, canEdit: true } }),
          driveFile("edited-by-other", { lastModifyingUser: { emailAddress: "someone@else.com" } }),
          driveFile("no-editor-12345", { lastModifyingUser: undefined }),
          driveFile("too-big-1234567", { size: "70000" }),
          driveFile("empty-12345678", { size: "0" }),
        ],
        {},
      ),
    });
    expect(out).toMatchObject({ files: 6, skipped: 6, saved: 0 });
    expect(out.problems).toHaveLength(6);
    // Files not written by Marc's account are never named.
    for (const p of out.problems.filter((x) => !x.trusted)) expect(p.name).toBe("");
    expect(submit).not.toHaveBeenCalled();
  });

  it("records invalid JSON, oversized arrays, rejected results and changed run keys without stopping the sweep", async () => {
    const submit = vi.fn(async (doc: unknown) => {
      if (!doc || typeof doc !== "object") throw new OpsError("Invalid result", 400);
      const key = (doc as { run_key: string }).run_key;
      if (key === "bad") throw new OpsError("Invalid result kind", 400);
      if (key === "changed")
        throw new OpsError("This run was already saved with different content", 409);
      return { received_at: NOW.toISOString() };
    });
    const out = await importDriveResults({
      folderId: FOLDER,
      ownerEmails: [OWNER],
      now: NOW,
      connect,
      submit,
      fetch: fakeDrive(
        [
          driveFile("not-json-123456"),
          driveFile("too-many-123456"),
          driveFile("mixed-12345678"),
        ],
        {
          "not-json-123456": "not json at all",
          "too-many-123456": Array.from({ length: 21 }, (_, i) => result(`k${i}`)),
          "mixed-12345678": [result("good"), result("bad"), result("changed")],
        },
      ),
    });
    // "not json at all" is valid JSON (a string) but not a result; the validator rejects it.
    expect(out).toMatchObject({ saved: 1, conflicts: 1 });
    expect(out.invalid).toBe(3);
    // Every rejection is reported so someone is told; the conflict is reported too.
    expect(out.problems).toHaveLength(4);
    expect(out.problems.map((p) => p.reason).join(" | ")).toMatch(/not valid JSON|too many|refused|run key/);
  });

  it("skips a file whose bytes changed after the checks", async () => {
    const submit = vi.fn();
    const drive = fakeDrive([driveFile("swapped-123456")], {
      "swapped-123456": result("daily:2026-11-10"),
    });
    const listing = [{ ...driveFile("swapped-123456"), md5Checksum: "f".repeat(32) }];
    const out = await importDriveResults({
      folderId: FOLDER,
      ownerEmails: [OWNER],
      now: NOW,
      connect,
      submit,
      fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
        String(url).includes("alt=media")
          ? drive(url, init)
          : Response.json({ files: listing }),
      ),
    });
    expect(out).toMatchObject({ files: 1, skipped: 1, saved: 0 });
    expect(submit).not.toHaveBeenCalled();
  });

  it("explains a folder that is not shared with the reader", async () => {
    await expect(
      importDriveResults({
        folderId: FOLDER,
        ownerEmails: [OWNER],
        now: NOW,
        connect,
        submit: vi.fn(),
        fetch: vi.fn(async () => new Response("no", { status: 404 })),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("stops on an unexpected save failure rather than hiding it", async () => {
    await expect(
      importDriveResults({
        folderId: FOLDER,
        ownerEmails: [OWNER],
        now: NOW,
        connect,
        submit: vi.fn(async () => {
          throw new OpsError("The save could not be confirmed", 503);
        }),
        fetch: fakeDrive([driveFile("file-one-123456")], {
          "file-one-123456": result("daily:2026-11-10"),
        }),
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
