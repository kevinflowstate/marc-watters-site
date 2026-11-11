import { describe, expect, it } from "vitest";
import { clientHealth, missedRounds, roundStart } from "@/lib/client-health";
import { initials } from "@/lib/initials";

// Wednesday 11 Nov 2026, 21:00 London. Rounds open on Thursdays: 5 Nov is the current one.
const now = new Date("2026-11-11T21:00:00Z");

describe("check-in rounds", () => {
  it("finds the Thursday the current round opened", () => {
    expect(roundStart(now, "thursday").toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(roundStart(new Date("2026-11-12T09:00:00Z"), "thursday").toISOString()).toBe("2026-11-12T00:00:00.000Z");
  });

  it("does not count the gap between two Thursdays as missed", () => {
    expect(missedRounds("2026-11-05T19:31:00Z", "2026-09-07T13:32:00Z", now)).toBe(0);
    // Thursday morning of the next round, before anyone has had a chance to submit.
    expect(missedRounds("2026-11-05T19:31:00Z", "2026-09-07T13:32:00Z", new Date("2026-11-12T08:00:00Z"))).toBe(0);
  });

  it("counts a round as missed once its grace period is over", () => {
    expect(missedRounds("2026-10-29T19:38:00Z", "2026-10-05T21:03:00Z", now)).toBe(1);
    expect(missedRounds("2026-10-20T13:11:00Z", "2026-07-13T14:46:00Z", now)).toBe(3);
  });

  it("gives a new client until their first full round", () => {
    expect(missedRounds(null, "2026-11-09T10:00:00Z", now)).toBe(0);
    expect(missedRounds(null, "2026-10-26T11:15:00Z", now)).toBe(2);
  });
});

describe("client health", () => {
  it("keeps a client green when they checked in this round, whatever the Home page says", () => {
    const h = clientHealth({ lastLogin: "2026-05-25T11:05:00Z", lastCheckin: "2026-11-06T14:31:00Z", createdAt: "2026-04-22T15:32:00Z" }, now);
    expect(h.status).toBe("green");
    expect(h.checked_in_this_round).toBe(true);
  });

  it("counts a message as activity (Marc's report: active clients shown as inactive)", () => {
    const h = clientHealth(
      {
        lastLogin: "2026-08-24T15:30:00Z",
        lastCheckin: null,
        createdAt: "2026-08-11T12:52:00Z",
        activity: { at: "2026-11-11T10:00:00Z", kind: "sent a message" },
      },
      now,
    );
    expect(h.status).toBe("amber");
    expect(h.days_inactive).toBe(0);
    expect(h.last_active_kind).toBe("sent a message");
  });

  it("only calls a client gone quiet after missed rounds AND 14 quiet days", () => {
    const quiet = clientHealth({ lastLogin: "2026-09-30T15:49:00Z", lastCheckin: "2026-09-25T20:07:00Z", createdAt: "2026-04-10T14:52:00Z" }, now);
    expect(quiet.status).toBe("red");
    expect(quiet.label).toBe("Gone quiet");
    const busy = clientHealth({ lastLogin: "2026-11-11T14:57:00Z", lastCheckin: "2026-10-20T13:11:00Z", createdAt: "2026-07-13T14:46:00Z" }, now);
    expect(busy.status).toBe("amber");
    expect(busy.label).toBe("Missed 3 check-ins");
  });

  it("marks new clients as new, not red", () => {
    const h = clientHealth({ lastLogin: null, lastCheckin: null, createdAt: "2026-11-10T09:00:00Z" }, now);
    expect(h.status).toBe("green");
    expect(h.label).toBe("New");
  });
});

describe("initials", () => {
  it("keeps avatars to two letters", () => {
    expect(initials("Dan Ennis | DE Landscapes LTD")).toBe("DE");
    expect(initials("Barry Mc Monagle")).toBe("BM");
    expect(initials("Martin O'Neill")).toBe("MO");
    expect(initials("Dreamco Bathrooms")).toBe("DB");
    expect(initials("chris cassidy")).toBe("CC");
    expect(initials("Holmes")).toBe("HO");
    expect(initials("")).toBe("?");
  });
});
