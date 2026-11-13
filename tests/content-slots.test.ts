import { describe, it, expect } from "vitest";
import { nextSlots, londonToUtc, londonInput } from "../lib/content/slots";
describe("London daily video slots", () => {
  it("starts tomorrow and skips every occupied day including non-18:00 CRM posts", () => {
    expect(
      nextSlots(
        3,
        ["2026-11-14T09:00:00Z", "2026-11-16T18:00:00Z"],
        new Date("2026-11-13T22:00:00Z"),
      ),
    ).toEqual([
      "2026-11-15T18:00:00.000Z",
      "2026-11-17T18:00:00.000Z",
      "2026-11-18T18:00:00.000Z",
    ]);
  });
  it("handles both clock changes and the London midnight boundary", () => {
    expect(nextSlots(2, [], new Date("2026-03-28T12:00:00Z"))).toEqual([
      "2026-03-29T17:00:00.000Z",
      "2026-03-30T17:00:00.000Z",
    ]);
    expect(nextSlots(1, [], new Date("2026-10-24T12:00:00Z"))[0]).toBe(
      "2026-10-25T18:00:00.000Z",
    );
    expect(nextSlots(1, [], new Date("2026-07-01T23:30:00Z"))[0]).toBe(
      "2026-07-03T17:00:00.000Z",
    );
  });
  it("never assigns beyond the read window", () =>
    expect(nextSlots(30, [], new Date("2026-11-13Z"))).toHaveLength(28));
  it("rejects invalid and ambiguous local inputs", () => {
    for (const v of [
      "2026-02-31T18:00",
      "2026-03-29T01:30",
      "2026-10-25T01:30",
    ])
      expect(() => londonToUtc(v)).toThrow();
    expect(londonInput(londonToUtc("2026-07-12T18:00"))).toBe(
      "2026-07-12T18:00",
    );
  });
});
