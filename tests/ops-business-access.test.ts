import { describe, expect, it, vi } from "vitest";
import { transformSync } from "esbuild";
import { readFileSync } from "node:fs";
import * as taskWeeks from "../lib/ops/task-weeks";
import * as identities from "../lib/ops/team-identities";
import * as access from "../lib/ops/business-report-access";
import type { WorkspaceResult } from "../lib/ops/workspace-types";

function route(path: string, actor: string | null, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const module = { exports: {} };
  class OpsError extends Error {
    constructor(message: string, public status: number) { super(message); }
  }
  const deps: Record<string, unknown> = {
    "@/lib/ops/http": {
      adminActor: async () => {
        if (!actor) throw new OpsError("Unauthorized", 401);
        return actor;
      },
      respondPrivate: (fn: () => unknown) => fn(),
    },
    "@/lib/ops/team-identities": identities,
    "@/lib/ops/task-weeks": taskWeeks,
    "@/lib/ops/hubdoc-dashboard": { readDashboardHubdoc: async () => null },
    "@/lib/ops/business-report-access": access,
    "@/lib/ops/tasks": { OpsError, record: (v: unknown) => v },
    ...mocks,
  };
  new Function("require", "exports", "module", transformSync(source, { format: "cjs", loader: "ts" }).code)(
    (id: string) => deps[id], module.exports, module,
  );
  return module.exports as Record<string, (...args: unknown[]) => Promise<unknown>>;
}

const privateText = "PRIVATE_FINANCIAL_INFORMATION";
const snapshot = {
  asOf: "now", weekStart: "monday", monthStart: "first",
  operations: { calls: { close_rate: 50, hidden: privateText }, hubdoc: { forwarded: 8 }, hidden: privateText },
  revenue: { netGBP: privateText }, internal: privateText,
};
const report = {
  id: "abc", status: "draft", week_start: "monday", updated_at: "today",
  observations_md: privateText, shared_observations_md: "Confirm pending calls",
  narrative_md: privateText, generated_narrative_md: privateText,
  data: { dashboard: { calls: { won: 4 }, monthly: privateText, priorities: [privateText] }, payments_received: privateText },
};
const reportPath = "../app/api/admin/reports/[id]/route.ts";
const context = { params: Promise.resolve({ id: "abc" }) };

describe("business access at portal boundaries", () => {
  it.each([identities.MARC_USER_ID, identities.KEVIN_FLOWSTATE_ADMIN_ID, identities.KEVIN_GMAIL_ADMIN_ID, identities.EIMEAR_USER_ID, "future-admin"])(
    "uses the same identity on saved and refreshed overview for %s", async actor => {
      const manager = ![identities.EIMEAR_USER_ID, "future-admin"].includes(actor);
      const load = vi.fn(async () => snapshot);
      const { GET, POST } = route("../app/api/admin/business-overview/route.ts", actor, {
        "@/lib/ops/business-overview-snapshot": { readBusinessOverview: load, refreshBusinessOverview: load },
      });
      for (const handler of [GET, POST]) {
        const result = await handler() as { snapshot: typeof snapshot };
        expect(result.snapshot).not.toHaveProperty("internal");
        expect(result.snapshot.operations.calls.close_rate).toBe(50);
        expect(JSON.stringify(result.snapshot.operations)).not.toContain(privateText);
        expect("revenue" in result.snapshot).toBe(manager);
        expect(result).toHaveProperty("capabilities.canViewTeamActivity", manager);
      }
    },
  );
  it("reads a later Codex receipt without refreshing the full snapshot or returning an old week's count", async () => {
    const latest = {forwarded:3,weekStart:"2026-11-23",coverage:"partial"};
    const load = vi.fn(async () => snapshot);
    const receipt = vi.fn<() => Promise<typeof latest | null>>().mockResolvedValueOnce(latest).mockResolvedValueOnce(null);
    const handlers = route("../app/api/admin/business-overview/route.ts", identities.EIMEAR_USER_ID, {
      "@/lib/ops/business-overview-snapshot": {readBusinessOverview:load},
      "@/lib/ops/hubdoc-dashboard": {readDashboardHubdoc:receipt},
    });
    expect(await handlers.GET()).toHaveProperty("snapshot.operations.hubdoc.forwarded",3);
    expect(await handlers.GET()).toHaveProperty("snapshot.operations.hubdoc",null);
  });
  it("checks login before either read or refresh", async () => {
    const load = vi.fn();
    const handlers = route("../app/api/admin/business-overview/route.ts", null, {
      "@/lib/ops/business-overview-snapshot": { readBusinessOverview: load, refreshBusinessOverview: load },
    });
    for (const handler of [handlers.GET, handlers.POST]) await expect(handler()).rejects.toMatchObject({ status: 401 });
    expect(load).not.toHaveBeenCalled();
  });
  it("returns safe report views for operations, including after an allowed write", async () => {
    const update = vi.fn(async () => ({ report }));
    const { GET, PATCH } = route(reportPath, identities.EIMEAR_USER_ID, {
      "@/lib/ops/reports": { getReport: async () => report, updateReport: update },
    });
    const req = (body: object) => new Request("https://portal.test/api/admin/reports/abc", { method: "PATCH", body: JSON.stringify(body) });
    const response = await GET(undefined, context);
    expect(response).toHaveProperty("reconciliationSheetUrl", null);
    expect(response).toHaveProperty("report.data.dashboard.calls.won", 4);
    expect(JSON.stringify(response)).not.toContain(privateText);
    const saved = await PATCH(req({shared_observations_md: "hello", expected_updated_at: "today"}), context);
    expect(JSON.stringify(saved)).not.toContain(privateText);
    for (const body of [{ action: "send" }, { narrative_md: "replace" }, { action: "review" }]) {
      await expect(PATCH(req(body), context)).rejects.toMatchObject({status: 403});
    }
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("projects finance and mixed free-text Workspace results without removing the run or operational receipt count", () => {
    const row: WorkspaceResult = { id: "a", run_key: "hubdoc:2026-11-23:scheduled", kind: "payments", title: privateText,
      summary: "Hubdoc forwards: 4. " + privateText, body: privateText, coverage: privateText, outcome: "partial",
      observed_at: "2026-11-23", received_at: "2026-11-23", links: [] };
    for (const kind of ["payments", "weekly_report", "sales_review", "daily_brief"] as const) {
      const source = { ...row, kind };
      const projected = access.workspaceResultForActor(source, identities.EIMEAR_USER_ID);
      expect(JSON.stringify(projected)).not.toContain(privateText);
      expect(projected.outcome).toBe("partial");
      if (kind === "payments") expect(projected.summary).toBe("Hubdoc forwards: 4.");
      expect(access.workspaceResultForActor(source, identities.KEVIN_GMAIL_ADMIN_ID)).toBe(source);
    }
  });
});
