import { beforeEach, describe, expect, it, vi } from "vitest";

const env: Record<string, string> = {};
vi.mock("@/lib/env", () => ({ getEnv: (k: string) => env[k] }));

import { paymentsReceived, strategyCalls, STRATEGY_CALENDAR } from "@/lib/ops/report-sources";

const ranges = {
  previous: { from: "2026-11-02T00:00:00.000Z", to: "2026-11-09T00:00:00.000Z" },
  current: { from: "2026-11-09T00:00:00.000Z", to: "2026-11-12T00:00:00.000Z" },
};

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
});

describe("strategy calls", () => {
  it("is not connected without a CRM token", async () => {
    expect(await strategyCalls(ranges, vi.fn())).toEqual({ connected: false, note: "not connected" });
  });

  it("counts bookings by booking date and calls by call time and status", async () => {
    env.GHL_LOCATION_TOKEN = "t";
    const f = vi.fn(async (url: string) => {
      const u = new URL(url);
      expect(u.searchParams.get("calendarId")).toBe(STRATEGY_CALENDAR);
      return Response.json({
        events: [
          { dateAdded: "2026-11-09T10:00:00Z", startTime: "2026-11-20T10:00:00Z", appointmentStatus: "confirmed" },
          { dateAdded: "2026-11-01T10:00:00Z", startTime: "2026-11-03T10:00:00Z", appointmentStatus: "showed" },
          { dateAdded: "2026-11-01T10:00:00Z", startTime: "2026-11-04T10:00:00Z", appointmentStatus: "noshow" },
          { dateAdded: "2026-11-03T10:00:00Z", startTime: "2026-11-10T10:00:00Z", appointmentStatus: "cancelled" },
          { dateAdded: "2026-11-03T10:00:00Z", startTime: "2026-11-10T11:00:00Z", appointmentStatus: "showed", deleted: true },
        ],
      });
    });
    const r = await strategyCalls(ranges, f as unknown as typeof fetch);
    expect(r.connected).toBe(true);
    if (!r.connected) return;
    expect(r.current).toEqual({ booked: 1, scheduled: 1, showed: 0, no_show: 0, cancelled: 1, not_yet_marked: 0 });
    expect(r.previous).toEqual({ booked: 1, scheduled: 2, showed: 1, no_show: 1, cancelled: 0, not_yet_marked: 0 });
  });

  it("reports not connected when the CRM refuses", async () => {
    env.GHL_LOCATION_TOKEN = "t";
    const r = await strategyCalls(ranges, vi.fn(async () => new Response("no", { status: 401 })) as unknown as typeof fetch);
    expect(r.connected).toBe(false);
  });
});

describe("payments received", () => {
  it("is not connected with no Stripe accounts", async () => {
    expect((await paymentsReceived(ranges, vi.fn(), [])).connected).toBe(false);
  });

  it("sums successful payments per period and currency, refunds separate, pages through", async () => {
    const ts = (iso: string) => Date.parse(iso) / 1000;
    const pages = [
      {
        has_more: true,
        data: [
          { id: "ch_1", status: "succeeded", paid: true, created: ts("2026-11-10T09:00:00Z"), currency: "gbp", amount_captured: 150000, amount_refunded: 0 },
          { id: "ch_2", status: "failed", paid: false, created: ts("2026-11-10T09:00:00Z"), currency: "gbp", amount_captured: 0 },
        ],
      },
      {
        has_more: false,
        data: [
          { id: "ch_3", status: "succeeded", paid: true, created: ts("2026-11-04T09:00:00Z"), currency: "gbp", amount_captured: 50000, amount_refunded: 10000 },
          { id: "ch_4", status: "succeeded", paid: true, created: ts("2026-11-04T09:00:00Z"), currency: "eur", amount_captured: 20000, amount_refunded: 0 },
        ],
      },
    ];
    const seen: string[] = [];
    const f = vi.fn(async (url: string) => {
      seen.push(new URL(url).searchParams.get("starting_after") || "");
      return Response.json(pages.shift());
    });
    const r = await paymentsReceived(ranges, f as unknown as typeof fetch, [{ label: "Programme", api_key: "k" }]);
    expect(seen).toEqual(["", "ch_2"]);
    expect(r.connected).toBe(true);
    const a = r.accounts![0] as Record<string, unknown>;
    expect(a.current).toEqual({ GBP: { payments: 1, amount: 1500, refunded: 0 } });
    expect(a.previous).toEqual({ GBP: { payments: 1, amount: 500, refunded: 100 }, EUR: { payments: 1, amount: 200, refunded: 0 } });
  });

  it("marks one account not connected when its key cannot read payments, keeping the others", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      String((init?.headers as Record<string, string>).Authorization).endsWith("bad")
        ? new Response("{}", { status: 403 })
        : Response.json({ has_more: false, data: [] }),
    );
    const r = await paymentsReceived(ranges, f as unknown as typeof fetch, [
      { label: "Programme", api_key: "good" },
      { label: "Events", api_key: "bad" },
    ]);
    expect(r.connected).toBe(true);
    expect(r.accounts!.map((a) => a.connected)).toEqual([true, false]);
  });
});
