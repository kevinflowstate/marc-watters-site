import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/push", () => ({ sendPushToUser: vi.fn() }));
vi.mock("@/lib/email-templates", () => ({ sendTeamTaskEmail: vi.fn() }));

import { archiveWeeks, isCarriedOver, isCompletedThisWeek, londonDateAt, weekStart } from "@/lib/ops/task-weeks";
import { notifyTaskOwner } from "@/lib/ops/task-notify";
import { attachCompletionTimes } from "@/lib/ops/workspace-feed";
import type { OpsTask } from "@/lib/ops/types";

const task = (over: Partial<OpsTask>): OpsTask =>
  ({ id: "t", kind: "task", status: "open", title: "Call the supplier", detail: null, area: "other", assignee: "eimear", priority: 2, client_id: null, source: "human", external_ref: null, proposal_revision: 1, links: [], outputs: [], payload: {}, due_at: null, decided_by: null, decided_at: null, decision_note: null, created_at: "2026-11-10T10:00:00Z", updated_at: "2026-11-10T10:00:00Z", ...over }) as OpsTask;

describe("task weeks (London, Monday to Sunday)", () => {
  it("starts the week at Monday 00:00 London in winter and summer", () => {
    expect(weekStart(new Date("2026-11-11T15:00:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    // Sunday 23:30 London is still the old week; Monday 00:10 London is the new one.
    expect(weekStart(new Date("2026-11-15T23:30:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(weekStart(new Date("2026-11-16T00:10:00Z")).toISOString()).toBe("2026-11-16T00:00:00.000Z");
    // BST: Monday 00:00 London is Sunday 23:00 UTC.
    expect(weekStart(new Date("2026-07-15T12:00:00Z")).toISOString()).toBe("2026-07-12T23:00:00.000Z");
    expect(weekStart(new Date("2026-07-12T23:30:00Z")).toISOString()).toBe("2026-07-12T23:00:00.000Z");
  });

  it("keeps completed tasks in this week's list until Sunday night, then archives them by week", () => {
    const now = new Date("2026-11-11T15:00:00Z");
    const thisWeek = task({ id: "a", status: "done", completed_at: "2026-11-10T09:00:00Z" });
    const lastWeek = task({ id: "b", status: "done", completed_at: "2026-11-06T16:00:00Z" });
    const lastWeekLater = task({ id: "c", status: "done", completed_at: "2026-11-08T22:00:00Z" });
    const older = task({ id: "d", status: "done", completed_at: "2026-10-28T10:00:00Z" });
    expect(isCompletedThisWeek(thisWeek, now)).toBe(true);
    expect(isCompletedThisWeek(lastWeek, now)).toBe(false);
    const weeks = archiveWeeks([thisWeek, lastWeek, lastWeekLater, older, task({ id: "e" })], now);
    expect(weeks.map((w) => [w.key, w.tasks.map((t) => t.id)])).toEqual([
      ["2026-11-02", ["c", "b"]],
      ["2026-10-26", ["d"]],
    ]);
    expect(weeks[0].label).toBe("Week of 2 Nov");
    // A week later this week's task has moved to the archive.
    expect(archiveWeeks([thisWeek], new Date("2026-11-16T08:00:00Z"))[0].key).toBe("2026-11-09");
  });

  it("marks open work from before Monday as carried over, never finished work", () => {
    const now = new Date("2026-11-11T15:00:00Z");
    expect(isCarriedOver(task({ created_at: "2026-11-06T10:00:00Z" }), now)).toBe(true);
    expect(isCarriedOver(task({ created_at: "2026-11-09T10:00:00Z" }), now)).toBe(false);
    expect(isCarriedOver(task({ created_at: "2026-11-06T10:00:00Z", status: "done" }), now)).toBe(false);
  });

  it("turns a picked due date into 5pm London", () => {
    expect(londonDateAt("2026-11-13")).toBe("2026-11-13T17:00:00.000Z");
    expect(londonDateAt("2026-07-13")).toBe("2026-07-13T16:00:00.000Z");
    expect(londonDateAt("13/11/2026")).toBeNull();
  });
});

describe("completion times come from the activity history", () => {
  it("uses the latest move to done, falling back to the last update", async () => {
    const tasks = [
      task({ id: "a", status: "done", updated_at: "2026-11-11T12:00:00Z" }),
      task({ id: "b", status: "done", updated_at: "2026-11-05T12:00:00Z" }),
      task({ id: "c", status: "open" }),
    ];
    await attachCompletionTimes(tasks, async () => [
      { task_id: "a", created_at: "2026-11-03T09:00:00Z" },
      { task_id: "a", created_at: "2026-11-10T09:00:00Z" },
    ]);
    expect(tasks.map((t) => t.completed_at)).toEqual(["2026-11-10T09:00:00Z", "2026-11-05T12:00:00Z", undefined]);
  });
});

describe("telling the other person about a task", () => {
  const admins = async () => [
    { id: "marc-id", email: "marc@example.com", full_name: "Marc Watters" },
    { id: "eimear-id", email: "eimear@example.com", full_name: "Eimear Shannon" },
    { id: "kevin-id", email: "kevin@example.com", full_name: "Kevin Harkin" },
  ];
  const deps = () => ({ admins, email: vi.fn(async () => ({}) as never), push: vi.fn(async () => ({ sent: 1, failed: 0 })), record: vi.fn(async () => true) });

  it("emails and pushes Eimear when Marc adds a task for her", async () => {
    const d = deps();
    const r = await notifyTaskOwner(task({ id: "t1", due_at: "2026-11-13T17:00:00Z" }), "marc-id", "created", d);
    expect(r.notified).toBe(true);
    expect(d.email).toHaveBeenCalledWith("eimear@example.com", expect.objectContaining({ fromName: "Marc", title: "Call the supplier", due: "Friday 13 November", taskId: "t1" }));
    expect(d.push).toHaveBeenCalledWith("eimear-id", expect.objectContaining({ title: "New task from Marc", url: "/admin/work?task=t1" }));
    expect(d.record).toHaveBeenCalledWith(expect.objectContaining({ user_id: "eimear-id", dedupe_key: "team-task:t1:created" }));
  });

  it("stays quiet for your own tasks, automatic tasks, the team lane and repeats", async () => {
    const d = deps();
    expect((await notifyTaskOwner(task({}), "eimear-id", "created", d)).why).toBe("own task");
    expect((await notifyTaskOwner(task({ source: "system" }), "marc-id", "created", d)).why).toBe("automatic task");
    expect((await notifyTaskOwner(task({ assignee: "flowstate" }), "marc-id", "created", d)).why).toBe("not a person");
    const repeat = { ...deps(), record: vi.fn(async () => false) };
    expect((await notifyTaskOwner(task({}), "marc-id", "created", repeat)).why).toBe("already told");
    expect(repeat.email).not.toHaveBeenCalled();
    expect(d.email).not.toHaveBeenCalled();
  });

  it("tells Marc when a task is passed to him, and never throws", async () => {
    const d = deps();
    const r = await notifyTaskOwner(task({ assignee: "marc", source: "system" }), "eimear-id", "assigned", d);
    expect(r.notified).toBe(true);
    expect(d.email).toHaveBeenCalledWith("marc@example.com", expect.objectContaining({ fromName: "Eimear", reassigned: true }));
    const broken = { ...deps(), admins: async () => { throw new Error("db down"); } };
    expect((await notifyTaskOwner(task({}), "marc-id", "created", broken)).why).toBe("error");
  });
});
