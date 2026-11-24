import { describe, it, expect, vi, beforeEach } from "vitest";
import { transformSync } from "esbuild";
import { readFileSync } from "node:fs";
import { businessCapabilities, MARC_USER_ID, EIMEAR_USER_ID, KEVIN_GMAIL_ADMIN_ID, KEVIN_FLOWSTATE_ADMIN_ID } from "../lib/ops/team-identities";

function moduleWith(path: string, imports: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const exports = {};
  const module = { exports };
  new Function(
    "require",
    "exports",
    "module",
    transformSync(source, {
      format: "cjs",
      loader: "ts",
      target: "es2022",
    }).code,
  )((id: string) => imports[id] || {}, exports, module);
  return module.exports as Record<string, (...args: unknown[]) => unknown>;
}
class OpsError extends Error {
  constructor(
    msg: string,
    public status: number,
  ) {
    super(msg);
  }
}
const report = vi.fn(async () => ({
  data: { periods: { current: { from: "2026-11-16", to: "2026-11-19" } } },
}));
const read = vi.fn(async () => ({ completed: 2 }));
const actor = vi.fn();
const deps = {
  "@/lib/ops/http": { adminActor: actor, respondPrivate: (fn: () => unknown) => fn() },
  "@/lib/ops/team-identities": { businessCapabilities },
  "@/lib/ops/task-weeks": { weekStart: () => new Date("2026-11-23T00:00:00Z") },
  "@/lib/ops/team-activity": { readTeamActivity: read },
  "@/lib/ops/reports": { getReport: report },
  "@/lib/ops/tasks": { OpsError },
};
describe("private manager activity", () => {
  beforeEach(() => vi.clearAllMocks());
  it("admits Marc and excludes Eimear at the server boundary before any activity read", async () => {
    const { GET } = moduleWith("../app/api/admin/team-activity/route.ts", deps);
    actor.mockResolvedValue(EIMEAR_USER_ID);
    const request = new Request(
      "https://portal.test/api/admin/team-activity?report=demo",
    );
    await expect(GET(request)).rejects.toMatchObject({ status: 404 });
    expect(read).not.toHaveBeenCalled();
    for (const manager of [MARC_USER_ID, KEVIN_GMAIL_ADMIN_ID, KEVIN_FLOWSTATE_ADMIN_ID]) {
      actor.mockResolvedValue(manager);
      await expect(GET(request)).resolves.toEqual({ completed: 2 });
    }
    expect(read).toHaveBeenCalledWith("2026-11-16", "2026-11-19");
  });
  it("enforces the same identity check for the live Dashboard week", async () => {
    const { GET } = moduleWith("../app/api/admin/team-activity/route.ts", deps);
    const req = new Request("https://portal.test/api/admin/team-activity");
    actor.mockResolvedValue("other-admin");
    await expect(GET(req)).rejects.toMatchObject({ status: 404 });
    expect(report).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    actor.mockResolvedValue(KEVIN_GMAIL_ADMIN_ID);
    await expect(GET(req)).resolves.toEqual({ completed: 2 });
    expect(read).toHaveBeenCalledWith("2026-11-23T00:00:00.000Z", expect.any(String));
  });
  it("does not count unattended gaps, duplicate completions or simple sign-in as active hours", () => {
    const { activitySummary } = moduleWith("../lib/ops/team-activity.ts", {});
    const events = ["09:00", "09:04", "16:00"].map((t) => ({
      created_at: "2026-11-16T" + t + ":00Z",
      action: "complete",
      task_id: "same",
    }));
    expect(activitySummary(events)).toEqual({
      completed: 1,
      actions: 3,
      activeMinutes: 4,
    });
    expect(activitySummary([])).toEqual({
      completed: 0,
      actions: 0,
      activeMinutes: 0,
    });
  });
});
