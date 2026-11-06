import { describe, expect, it } from "vitest";
import {
  clientSignalCards,
  artifactCards,
  taskCards,
  paymentCards,
} from "../lib/ops/workspace-feed";
import { validateWorkspaceResult } from "../lib/ops/workspace-results";
import type { OpsArtifact } from "../lib/ops/action-types";
import type { OpsTask } from "../lib/ops/types";
import type { PaymentCase } from "../lib/ops/payment-policy";

const now = Date.parse("2026-11-06T13:00:00Z");
const recent = "2026-11-06T12:00:00Z",
  old = "2026-10-01T12:00:00Z";
const client = {
  id: "client-1",
  user: { full_name: "Example Client" },
  last_login: recent,
  last_checkin: recent,
};
const msg = (role: string, at = recent) => ({
  id: role,
  client_id: client.id,
  sender_role: role,
  created_at: at,
});
const checkin = {
  id: "checkin-1",
  client_id: client.id,
  created_at: old,
  admin_reply: "Thanks",
  replied_at: recent,
};
const flags = (
  messages: Parameters<typeof clientSignalCards>[1],
  checkins: Parameters<typeof clientSignalCards>[2] = [],
) => clientSignalCards([client], messages, checkins, now);

describe("live workspace signals", () => {
  it("uses stable identities and treats read messages as still needing a reply", () => {
    const input = [{ ...msg("client"), read_by_admin: true }];
    expect(flags(input)[0].id).toBe("client:client-1");
    expect(flags(input)[0].signal_ids).toContain("message:client-1");
    expect(flags(input)).toEqual(flags(input));
  });
  it("removes a reply flag after an admin reply and reopens for a later client message", () => {
    expect(flags([msg("client", old), msg("admin")])).toEqual([]);
    expect(flags([msg("client"), msg("admin", old)])[0].state).toBe(
      "Needs a reply",
    );
  });
  it("does not infer a reply order from matching or invalid timestamps", () => {
    expect(flags([msg("admin"), msg("client")])[0].state).toBe(
      "Needs checking",
    );
    expect(flags([msg("admin", "bad"), msg("client")])[0].state).toBe(
      "Needs checking",
    );
  });
  it("recognises a new client reply on an already reviewed check-in", () => {
    expect(flags([], [checkin])).toEqual([]);
    expect(
      flags(
        [],
        [
          {
            ...checkin,
            client_reply: "One more thing",
            client_replied_at: "2026-11-06T12:01:00Z",
          },
        ],
      )[0].signal_ids,
    ).toContain("checkin:client-1");
  });
  it("shows an unknown activity record honestly", () => {
    const cards = clientSignalCards(
      [{ ...client, last_login: null, last_checkin: null }],
      [],
      [],
      now,
    );
    expect(cards[0].state).toBe("Not enough information");
    expect(cards[0].detail).toContain("does not prove");
  });
  it("uses recent training and message activity to avoid false inactivity flags", () => {
    const stale = { ...client, last_login: old, last_checkin: old };
    expect(
      clientSignalCards([stale], [], [], now).some((c) =>
        c.signal_ids?.some((id) => id.startsWith("activity:")),
      ),
    ).toBe(true);
    expect(
      clientSignalCards([stale], [msg("client")], [], now).some((c) =>
        c.signal_ids?.some((id) => id.startsWith("activity:")),
      ),
    ).toBe(false);
    expect(
      clientSignalCards(
        [stale],
        [],
        [],
        now,
        [{ id: "training", client_id: client.id, completed_at: recent }],
        [],
      ).some((c) => c.signal_ids?.some((id) => id.startsWith("activity:"))),
    ).toBe(false);
  });
  it("does not call a client inactive when any activity source failed", () => {
    expect(
      clientSignalCards(
        [{ ...client, last_login: old, last_checkin: old }],
        null,
        [],
        now,
      ).some((c) => c.signal_ids?.some((id) => id.startsWith("activity:"))),
    ).toBe(false);
    expect(
      clientSignalCards(
        [{ ...client, last_login: old, last_checkin: old }],
        [],
        [],
        now,
        null,
      ).some((c) => c.signal_ids?.some((id) => id.startsWith("activity:"))),
    ).toBe(false);
  });
  it("does not treat absent messages as proof that check-ins succeeded", () => {
    expect(flags(null, [{ ...checkin, admin_reply: null }])[0].area).toBe(
      "engagement",
    );
  });
});
describe("workspace action projections", () => {
  it("keeps changed artwork visible with Flowstate and excludes superseded versions", () => {
    const a = {
      id: "art",
      kind: "content",
      status: "rejected",
      version: 2,
    } as OpsArtifact;
    expect(artifactCards([a])[0]).toMatchObject({
      owner: "flowstate",
      attention: true,
      history: false,
    });
    expect(artifactCards([{ ...a, status: "superseded" }])).toEqual([]);
    expect(artifactCards([{ ...a, status: "approved" }])[0]).toMatchObject({
      history: false,
      approval: false,
    });
  });
  it("keeps changes requested on ordinary approval tasks out of history", () => {
    const t = {
      id: "t",
      assignee: "eimear",
      status: "rejected",
      kind: "approval",
      area: "content",
    } as OpsTask;
    expect(taskCards([t])[0]).toMatchObject({
      history: false,
      attention: true,
    });
  });
  it("settles paid cases without hiding a replied unpaid case", () => {
    const p = {
      id: "p",
      state: "unpaid",
      reply_needs_human: true,
      reminder_count: 1,
    } as PaymentCase;
    expect(paymentCards([p])[0].next).toContain("client replied");
    expect(paymentCards([{ ...p, state: "paid" }])[0]).toMatchObject({
      history: true,
      attention: false,
    });
  });
});
describe("Codex result contract", () => {
  const valid = {
    run_key: "daily:2026-11-06:v1",
    kind: "daily_brief",
    title: "Today",
    summary: "Three items",
    body: "Review the diary",
    coverage: "Calendar and Drive only; portal missing",
    outcome: "partial",
    observed_at: recent,
    links: [
      {
        label: "Source",
        url: "https://docs.google.com/document/d/example/edit",
      },
    ],
  };
  it("requires explicit coverage and retains partial/failed outcomes", () => {
    expect(validateWorkspaceResult(valid, now).outcome).toBe("partial");
    expect(
      validateWorkspaceResult({ ...valid, outcome: "failed" }, now).outcome,
    ).toBe("failed");
    expect(() =>
      validateWorkspaceResult({ ...valid, coverage: "" }, now),
    ).toThrow();
  });
  it("rejects approval, execution and HTML/javascript injection fields", () => {
    expect(() =>
      validateWorkspaceResult({ ...valid, status: "approved" }, now),
    ).toThrow();
    expect(() =>
      validateWorkspaceResult(
        { ...valid, links: [{ label: "x", url: "javascript:alert(1)" }] },
        now,
      ),
    ).toThrow();
  });
  it("rejects future checks, invalid kinds and oversized results", () => {
    expect(() =>
      validateWorkspaceResult({ ...valid, observed_at: "2027-01-01" }, now),
    ).toThrow();
    expect(() =>
      validateWorkspaceResult({ ...valid, kind: "send_message" }, now),
    ).toThrow();
    expect(() =>
      validateWorkspaceResult({ ...valid, body: "x".repeat(20001) }, now),
    ).toThrow();
  });
});
