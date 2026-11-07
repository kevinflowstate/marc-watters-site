import { describe, beforeEach, expect, it, vi } from "vitest";
const admin = vi.hoisted(() => vi.fn());
const ghl = vi.hoisted(() => vi.fn());
const drive = vi.hoisted(() => vi.fn());
const folder = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ops/http", () => ({
  adminActor: admin,
  respond: async (fn: () => Promise<unknown>) => {
    try {
      return Response.json(await fn());
    } catch {
      return Response.json({ error: "Access denied" }, { status: 401 });
    }
  },
}));
vi.mock("@/lib/ops/content-scheduling", () => ({
  verifyGhlContentConnection: ghl,
}));
vi.mock("@/lib/ops/drive-connection", () => ({
  connectContentDrive: drive,
  verifyContentDriveAccess: folder,
}));
import { GET } from "../app/api/admin/ops/connections/route";
describe("connection checks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("requires an admin before accessing either provider", async () => {
    admin.mockRejectedValue(new Error("no session"));
    expect((await GET()).status).toBe(401);
    expect(ghl).not.toHaveBeenCalled();
    expect(drive).not.toHaveBeenCalled();
  });
  it("reports each connection separately, never returns credentials or raw errors", async () => {
    admin.mockResolvedValue("admin");
    ghl.mockResolvedValue({
      location: { id: "marc", name: "MRW Management LTD" },
      user: { id: "marc-user", name: "Marc", secret: "hidden" },
      accounts: [],
    });
    drive.mockRejectedValue(new Error("SECRET_GOOGLE_DETAILS"));
    const r = await (await GET()).json();
    expect(r.ghl.connected).toBe(true);
    expect(r.drive.connected).toBe(false);
    expect(r.read_only).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/SECRET_GOOGLE_DETAILS|hidden/);
    expect(folder).not.toHaveBeenCalled();
  });
});
