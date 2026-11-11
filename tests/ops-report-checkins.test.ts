import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";

// Same isolation pattern as ops-report-social: run report-data.ts with fake dependencies.
const source = readFileSync(new URL("../lib/ops/report-data.ts", import.meta.url), "utf8");
const code = transformSync(source.replace(/^import .*;$/gm, "").replaceAll("export ", ""), {
  loader: "ts",
  target: "es2022",
}).code;

function fakeDb(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const q = {
        select: () => q,
        order: () => q,
        gte: () => q,
        lt: () => q,
        range: (a: number, b: number) => Promise.resolve({ data: rows.slice(a, b + 1), error: null }),
      };
      return q;
    },
  };
}

describe("Thursday report check-ins", () => {
  it("reports last week's Thursday round and never a 0 for this week, which ends before Thursday", async () => {
    const clients = [1, 2, 3, 4].map((i) => ({ id: `c${i}`, created_at: "2026-09-01T00:00:00Z", archived_at: null }));
    const checkins = [
      { id: "k1", client_id: "c1", created_at: "2026-11-05T18:00:00.000Z" }, // Thu 5 Nov
      { id: "k2", client_id: "c2", created_at: "2026-11-05T19:00:00.000Z" },
      { id: "k3", client_id: "c3", created_at: "2026-11-06T09:00:00.000Z" }, // Fri straggler
    ];
    const gather = new Function(
      "createAdminClient",
      "getEnv",
      "fetch",
      "strategyCalls",
      "paymentsReceived",
      code + ";return gatherReportData;",
    )(
      () => fakeDb({ client_profiles: clients, checkins }),
      () => "",
      () => Promise.reject(new Error("no network in tests")),
      async () => ({ connected: false }),
      async () => ({ connected: false }),
    );
    // Thursday 12 Nov 2026, 06:00 London: when the portal builds the figures.
    const data = await gather(new Date("2026-11-12T06:00:00Z"));
    expect(data.previous.checkins).toMatchObject({ connected: true, submitted: 3, expected: 4, submissions_total: 3 });
    expect(data.current.checkins).toMatchObject({ connected: true, not_due: true });
    expect(data.current.checkins.submitted).toBeUndefined();
  });
});
