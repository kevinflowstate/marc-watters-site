import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/ops/tasks", () => ({ createTask: vi.fn() }));

import { checkScheduledJobs, londonClock, reportFileProblems, reportStepFailure } from "@/lib/ops/job-health";

const row = (kind: string, outcome: string, observed_at: string) => ({ kind, outcome, observed_at, run_key: `${kind}:x` });

describe("job health", () => {
  it("reads London time across the clock change", () => {
    expect(londonClock(new Date("2026-11-10T09:45:00Z"))).toMatchObject({ date: "2026-11-10", minutes: 585, weekday: true });
    expect(londonClock(new Date("2026-07-10T08:45:00Z"))).toMatchObject({ minutes: 585 });
    expect(londonClock(new Date("2026-11-14T12:00:00Z")).weekday).toBe(false);
  });

  it("raises nothing before a job's deadline, then one missed-run task with a stable reference", async () => {
    const raiseTask = vi.fn(async (..._args: unknown[]) => ({}) as never);
    const results = vi.fn(async () => []);
    expect((await checkScheduledJobs(new Date("2026-11-10T09:00:00Z"), { results, raiseTask })).raised).toEqual([]);
    const r = await checkScheduledJobs(new Date("2026-11-10T10:00:00Z"), { results, raiseTask });
    expect(r.raised).toEqual(["job-health:missed:daily:2026-11-10"]);
    const task = raiseTask.mock.calls[0][0] as Record<string, unknown>;
    expect(task).toMatchObject({ assignee: "flowstate", kind: "task", external_ref: "job-health:missed:daily:2026-11-10" });
  });

  it("is satisfied by a result observed on the same London day, and flags a failed run", async () => {
    const raiseTask = vi.fn(async (..._args: unknown[]) => ({}) as never);
    const results = vi.fn(async () => [
      row("daily_brief", "partial", "2026-11-10T08:27:00Z"),
      row("sales_review", "failed", "2026-11-10T17:35:00Z"),
    ]);
    const r = await checkScheduledJobs(new Date("2026-11-10T19:00:00Z"), { results, raiseTask });
    expect(r.raised).toEqual(["job-health:failed:sales:2026-11-10"]);
  });

  it("does not count yesterday's result as today's", async () => {
    const raiseTask = vi.fn(async (..._args: unknown[]) => ({}) as never);
    const results = vi.fn(async () => [row("daily_brief", "complete", "2026-11-09T08:27:00Z")]);
    const r = await checkScheduledJobs(new Date("2026-11-10T10:00:00Z"), { results, raiseTask });
    expect(r.raised).toContain("job-health:missed:daily:2026-11-10");
  });

  it("does not check at weekends", async () => {
    const results = vi.fn(async () => []);
    expect(await checkScheduledJobs(new Date("2026-11-14T20:00:00Z"), { results, raiseTask: vi.fn() })).toEqual({ checked: false, raised: [] });
    expect(results).not.toHaveBeenCalled();
  });

  it("raises one task per day for rejected files, never naming untrusted ones, and one per broken step", async () => {
    const raiseTask = vi.fn(async (..._args: unknown[]) => ({}) as never);
    await reportFileProblems(
      [
        { trusted: true, name: "daily.json", reason: "empty, larger than 64 KB or unreadable" },
        { trusted: false, name: "", reason: "created or last changed by someone other than Marc's account" },
      ],
      new Date("2026-11-10T12:00:00Z"),
      raiseTask,
    );
    const filesTask = raiseTask.mock.calls[0][0] as Record<string, unknown>;
    expect(filesTask.external_ref).toBe("job-health:files:2026-11-10");
    expect(String(filesTask.detail)).toContain("daily.json");
    expect(String(filesTask.detail)).toContain("1 file not from Marc's account was ignored");
    await reportStepFailure("portal-snapshot", "Google refused", new Date("2026-11-10T12:00:00Z"), raiseTask);
    expect((raiseTask.mock.calls[1][0] as Record<string, unknown>).external_ref).toBe("job-health:step:portal-snapshot:2026-11-10");
  });

  it("never throws when the task itself cannot be saved for a broken step", async () => {
    await expect(reportStepFailure("drive-results", "x", new Date(), vi.fn(async () => { throw new Error("db down"); }))).resolves.toBeUndefined();
  });
});
