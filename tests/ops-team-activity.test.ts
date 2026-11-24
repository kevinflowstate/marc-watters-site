import { describe, it, expect, vi, beforeEach } from "vitest";
import { transformSync } from "esbuild";
import { readFileSync } from "node:fs";
import { MARC_USER_ID, EIMEAR_USER_ID } from "../lib/ops/call-outcomes";

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
  "@/lib/ops/http": { adminActor: actor, respond: (fn: () => unknown) => fn() },
  "@/lib/ops/call-outcomes": { MARC_USER_ID },
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
    actor.mockResolvedValue(MARC_USER_ID);
    await expect(GET(request)).resolves.toEqual({ completed: 2 });
    expect(read).toHaveBeenCalledWith("2026-11-16", "2026-11-19");
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
