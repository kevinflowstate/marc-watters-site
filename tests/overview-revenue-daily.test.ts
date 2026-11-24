import { describe, expect, it } from "vitest";
import { dailyNetPence, dailySeries } from "../lib/ops/overview-revenue";

const at = (iso: string) => Date.parse(iso) / 1000;

describe("daily revenue series", () => {
  const from = at("2026-11-01T00:00:00Z");
  const to = at("2026-11-04T10:00:00Z");
  const charges = [
    { status: "succeeded", paid: true, currency: "gbp", amount_captured: 10000, created: at("2026-11-01T09:00:00Z") },
    { status: "succeeded", paid: true, currency: "gbp", amount_captured: 5000, created: at("2026-11-03T23:30:00Z") },
    { status: "failed", paid: false, currency: "gbp", amount_captured: 0, created: at("2026-11-02T09:00:00Z") },
    { status: "succeeded", paid: true, currency: "eur", amount_captured: 7000, created: at("2026-11-02T09:00:00Z") },
  ];
  const refunds = [{ status: "succeeded", currency: "gbp", amount: 2500, created: at("2026-11-02T12:00:00Z") }];

  it("buckets net GBP by London day with every elapsed day present", () => {
    const series = dailySeries([dailyNetPence(charges, refunds, from, to)], from, to);
    expect(series).toEqual([
      { date: "2026-11-01", netGBP: 100 },
      { date: "2026-11-02", netGBP: -25 },
      { date: "2026-11-03", netGBP: 50 },
      { date: "2026-11-04", netGBP: 0 },
    ]);
  });

  it("uses the London date across BST", () => {
    const summer = [{ status: "succeeded", paid: true, currency: "gbp", amount_captured: 100, created: at("2026-07-01T23:30:00Z") }];
    const m = dailyNetPence(summer, [], at("2026-06-30T23:00:00Z"), at("2026-07-03T00:00:00Z"));
    expect([...m!.keys()]).toEqual(["2026-07-02"]);
  });

  it("is unknown when any merchant is incomplete", () => {
    expect(dailyNetPence(charges, null, from, to)).toBeNull();
    expect(dailySeries([dailyNetPence(charges, refunds, from, to), null], from, to)).toBeNull();
  });
});
