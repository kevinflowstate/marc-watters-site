import { adminReturnPath } from "@/lib/admin-return-path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/api/admin/sales-calls/route";
import { adminActor } from "@/lib/ops/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { callsForPeriod } from "@/lib/ops/sales-calls";
import { MARC_USER_ID, EIMEAR_USER_ID, KEVIN_FLOWSTATE_ADMIN_ID, KEVIN_GMAIL_ADMIN_ID } from "@/lib/ops/team-identities";

vi.mock("@/lib/ops/http", async (original) => ({ ...await original<object>(), adminActor: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/ops/sales-calls", async (original) => ({ ...await original<object>(), callsForPeriod: vi.fn() }));

const booking = {
  id: "fictional-slot", name: "Sample appointment", startTime: "2026-11-23T10:00:00Z",
  bookedAt: "2026-11-17T09:00:00Z", status: "confirmed", outcome: null, revision: null,
};
const request = (method = "GET") => new Request("https://portal.test/api/admin/sales-calls", {
  method,
  ...(method === "PATCH" ? { body: JSON.stringify({ ...booking, outcome: "follow_up" }) } : {}),
});

afterEach(() => vi.useRealTimers());

describe("sales register portal access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    vi.mocked(callsForPeriod).mockResolvedValue([booking]);
  });
  it("returns a signed-in admin to the register and only accepts local admin paths", () => {
    expect(adminReturnPath("/admin/sales-calls")).toBe("/admin/sales-calls");
    for (const other of ["//outside.test", "/admin/../login", "/portal", "/admin/\\outside", null]) {
      expect(adminReturnPath(other)).toBe("/admin");
    }
  });
  it.each([MARC_USER_ID, KEVIN_FLOWSTATE_ADMIN_ID, KEVIN_GMAIL_ADMIN_ID])("lets manager %s load and mark a call", async (actor) => {
    vi.mocked(adminActor).mockResolvedValue(actor);
    const list = await GET(request());
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ calls: [booking], canEdit: true });
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { updated_at: "saved" } }) }) }));
    vi.mocked(createAdminClient).mockReturnValue({ from: () => ({ insert }) } as unknown as ReturnType<typeof createAdminClient>);
    expect((await PATCH(request("PATCH"))).status).toBe(200);
    expect(insert).toHaveBeenCalledWith({ appointment_id: booking.id, starts_at: booking.startTime, outcome: "follow_up", recorded_by: actor });
  });
  it.each([EIMEAR_USER_ID, "another-admin"])("gives admin %s read-only access", async (actor) => {
    vi.mocked(adminActor).mockResolvedValue(actor);
    expect(await (await GET(request())).json()).toMatchObject({ calls: [booking], canEdit: false });
    expect((await PATCH(request("PATCH"))).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("Dashboard after an outcome is saved", () => {
  it("re-reads the week’s calls after an edit and keeps other morning figures intact", async () => {
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    const { readBusinessOverview } = await import("@/lib/ops/business-overview-snapshot");
    const snapshot = { weekStart: "2026-11-23", asOf: "2026-11-24T08:00:00Z", operations: { leads: 4, calls: null } };
    const query = {
      select() { return this; }, eq() { return this; }, gte() { return this; }, lt() { return this; },
      gt: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ appointment_id: booking.id }] }),
      single: async () => ({ data: { snapshot } }),
    };
    vi.mocked(createAdminClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(callsForPeriod).mockResolvedValue([{ ...booking, outcome: "won", revision: "saved" }]);
    const fresh = await readBusinessOverview();
    expect(query.gt).toHaveBeenCalledWith("updated_at", snapshot.asOf);
    expect(fresh?.operations).toMatchObject({ leads: 4, calls: { scheduled: 1, won: 1, close_rate: 100 } });
  });
});
