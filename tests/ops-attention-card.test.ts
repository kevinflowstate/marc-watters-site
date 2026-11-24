import { describe, expect, it } from "vitest";
import { businessAttention } from "../lib/ops/business-attention";
import type { OpsTask } from "../lib/ops/types";
import type { WorkspaceCard } from "../lib/ops/workspace-types";
const now = new Date("2026-11-24T11:00:00Z");
function task(id: string, changes: Partial<OpsTask> = {}): OpsTask {
  return {
    id,
    title: id,
    kind: "task",
    status: "open",
    area: "other",
    assignee: "marc",
    source: "human",
    priority: 2,
    created_at: "2026-11-22T12:00:00Z",
    payload: {},
    ...changes,
  } as OpsTask;
}
const call = {
  id: "a",
  name: "Example member",
  startTime: "2026-11-23T10:00:00Z",
  endTime: "2026-11-23T10:30:00Z",
  status: "confirmed",
  outcome: null,
};
describe("Dashboard attention", () => {
  it("filters owners, completed work, approvals already decided and future routine work, while retaining event questions", () => {
    const tasks = [
      task("today"),
      task("tomorrow", { due_at: "2026-11-25" }),
      task("closed", { status: "done" }),
      task("approved", { status: "approved" }),
      task("delegate", { assignee: "eimear" }),
      task("event", {
        area: "events",
        assignee: "eimear",
        status: "awaiting_approval",
        payload: { event_board_id: "board" },
      }),
      task("amount", { area: "finance" }),
      task("routine", { source: "system", external_ref: "engagement:routine" }),
    ];
    const result = businessAttention({ tasks, checks: [] }, [], false, now);
    expect(result.items.map((i) => i.title)).toEqual(["event", "today"]);
    expect(result.items[0].href).toBe("/admin/events?board=board#step-event");
    expect(
      businessAttention({ tasks, checks: [] }, [], true, now).items.map(
        (i) => i.title,
      ),
    ).toContain("amount");
  });
  it("links outstanding and follow-up calls, excluding future, decided and cancelled calls", () => {
    const result = businessAttention(
      { tasks: [], checks: [] },
      [
        call,
        { ...call, id: "b", outcome: "follow_up" },
        { ...call, id: "c", status: "cancelled" },
        { ...call, id: "d", outcome: "won" },
        { ...call, id: "e", endTime: "2026-11-25T10:30:00Z" },
      ],
      true,
      now,
    );
    expect(result.items.map((i) => i.href)).toEqual([
      "/admin/sales-calls#call-a",
      "/admin/sales-calls#call-b",
    ]);
    expect(result.items[1].reason).toContain("Follow up");
  });
  it("links each outstanding coaching action directly to its client", () => {
    const coaching = [
      {
        id: "client:42",
        title: "Sample Client · message needs a reply",
        url: "/admin/clients/42",
        signal_ids: ["message:42", "checkin:42"],
      },
    ] as WorkspaceCard[];
    expect(
      businessAttention(
        { tasks: [], checks: [], coaching },
        [],
        true,
        now,
      ).items.map((i) => i.href),
    ).toEqual(["/admin/inbox?client=42", "/admin/clients/42"]);
  });
  it("distinguishes a missing source from a checked empty queue", () => {
    expect(businessAttention(null, null, false, now).unavailable).toHaveLength(
      3,
    );
    expect(
      businessAttention({ tasks: [], checks: [] }, [], false, now),
    ).toEqual({ items: [], unavailable: [] });
  });
});
