import { describe, expect, it } from "vitest";
import { lastPortalActivity, portalClientStatus } from "../lib/portal-activity";

const now = Date.parse("2026-10-01T18:00:00Z");
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();
const createdAt = daysAgo(160);

describe("portal check-ins count as activity", () => {
  it("clears the reported false red flag without rewriting the recorded login", () => {
    const lastLogin = "2026-05-25T11:05:33.025+00:00";
    const lastCheckin = "2026-10-01T16:06:03.187+00:00";
    expect(lastPortalActivity(lastLogin, lastCheckin, createdAt)).toBe(lastCheckin);
    expect(portalClientStatus(lastLogin, lastCheckin, createdAt, now)).toBe("green");
  });

  it.each([
    [129, 0, "green"],
    [129, 7, "green"],
    [129, 8, "amber"],
    [129, 10, "amber"],
    [129, 11, "red"],
    [0, 14, "amber"],
    [0, 14.01, "red"],
    [0, 15, "red"],
    [0, 0, "green"],
  ] as const)("login %s days ago and check-in %s days ago is %s", (loginDays, checkinDays, status) => {
    expect(portalClientStatus(daysAgo(loginDays), daysAgo(checkinDays), createdAt, now)).toBe(status);
  });

  it("keeps the more recent home-page activity when the check-in is older", () => {
    expect(lastPortalActivity(daysAgo(1), daysAgo(8), createdAt)).toBe(daysAgo(1));
  });

  it("counts a direct check-in when no home-page visit was recorded", () => {
    expect(lastPortalActivity(null, daysAgo(0), createdAt)).toBe(daysAgo(0));
    expect(portalClientStatus(null, daysAgo(0), createdAt, now)).toBe("green");
  });

  it("preserves the grace period and overdue rules for clients who never checked in", () => {
    expect(lastPortalActivity(null, null, daysAgo(2))).toBe(daysAgo(2));
    expect(portalClientStatus(null, null, daysAgo(2), now)).toBe("green");
    expect(portalClientStatus(null, null, daysAgo(8), now)).toBe("amber");
    expect(portalClientStatus(null, null, daysAgo(11), now)).toBe("red");
    expect(portalClientStatus(daysAgo(0), null, daysAgo(15), now)).toBe("red");
  });

  it("compares actual instants across timezone offsets", () => {
    const login = "2026-10-01T16:30:00Z";
    const checkin = "2026-10-01T17:06:00+01:00";
    expect(lastPortalActivity(login, checkin, createdAt)).toBe(login);
  });
});
