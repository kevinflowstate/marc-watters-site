import { describe, expect, it } from "vitest";
import { checkinReplyState } from "../lib/checkin-reply-state";

const checkin = {
  id: "checkin", client_id: "client",
  created_at: "2026-04-24T09:08:21Z",
  admin_reply: "Original reply", replied_at: "2026-04-24T17:05:08Z",
  client_reply: "Follow-up", client_replied_at: "2026-04-27T09:25:52Z",
};
const inboxReply = {
  id: "verified-message", client_id: "client", sender_role: "admin",
  created_at: "2026-04-27T12:21:47Z",
};

describe("check-in reply evidence shared by dashboard and workspace", () => {
  it("keeps the follow-up open until a specific inbox reply is linked", () => {
    expect(checkinReplyState(checkin)).toEqual({ needs_reply: true, reason: "client_replied_after_admin" });
  });
  it("recognises the linked reply without modifying the original conversation", () => {
    const input = { ...checkin, inbox_reply: inboxReply };
    const before = structuredClone(input);
    expect(checkinReplyState(input)).toEqual({ needs_reply: false, reason: "admin_replied_in_inbox" });
    expect(input).toEqual(before);
  });
  it("reopens for a new client follow-up after the linked inbox reply", () => {
    expect(checkinReplyState({ ...checkin, inbox_reply: inboxReply, client_replied_at: "2026-04-28T09:00:00Z" }).needs_reply).toBe(true);
  });
  it.each([
    { client_id: "another-client" }, { sender_role: "client" }, { id: "" },
    { created_at: "invalid" }, { created_at: checkin.client_replied_at },
    { created_at: "2026-04-26T09:00:00Z" },
  ])("does not clear a follow-up with invalid or unrelated linked evidence: %j", (change) => {
    expect(checkinReplyState({ ...checkin, inbox_reply: { ...inboxReply, ...change } }).needs_reply).toBe(true);
  });
  it("does not let an inbox link conceal missing or uncertain original replies", () => {
    expect(checkinReplyState({ ...checkin, admin_reply: "", inbox_reply: inboxReply }).needs_reply).toBe(true);
    expect(checkinReplyState({ ...checkin, replied_at: null, inbox_reply: inboxReply }).needs_reply).toBe(null);
  });
});
