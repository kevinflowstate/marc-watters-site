import { describe, expect, it } from "vitest";
import { workViews, needsApproval, isClosed } from "../lib/ops/workspace";
import type { OpsTask } from "../lib/ops/types";
describe("workspace approval and completion states", () => {
  const task = (
    status: OpsTask["status"],
    kind: OpsTask["kind"] = "approval",
  ) => ({ status, kind }) as OpsTask;
  it("keeps an approved item visible until execution is complete", () => {
    const approved = task("approved"),
      done = task("done");
    const views = workViews([approved, done]);
    expect(views["All current"]).toEqual([approved]);
    expect(views.History).toEqual([done]);
    expect(views["Needs approval"]).toEqual([]);
  });
  it("requires a decision for all pending approval states, but not ordinary tasks", () => {
    for (const status of ["open", "in_progress", "awaiting_approval"] as const)
      expect(needsApproval(task(status))).toBe(true);
    expect(needsApproval(task("open", "task"))).toBe(false);
    expect(needsApproval(task("approved"))).toBe(false);
  });
  it("shows only unresolved flags under needs attention", () => {
    const open = task("open", "flag");
    expect(
      workViews([open, task("done", "flag"), task("cancelled", "flag")])[
        "Needs attention"
      ],
    ).toEqual([open]);
  });
  it("keeps requested changes actionable in the same views as the task cards", () => {
    const rejected = task("rejected");
    expect(isClosed(rejected)).toBe(false);
    expect(needsApproval(rejected)).toBe(false);
    expect(workViews([rejected])).toMatchObject({
      "All current": [rejected], "Needs attention": [rejected], "Needs approval": [], History: [],
    });
  });
});
