import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";
const code = transformSync(
  readFileSync(new URL("../lib/ops/reports.ts", import.meta.url), "utf8"),
  { loader: "ts", format: "cjs", target: "es2022" },
).code;
type Row = Record<string, unknown> & { data?: Record<string, unknown> };
function harness(initial?: Row) {
  let row = initial ? { ...initial } : null;
  let version = 1;
  const gather = vi.fn(async () => ({
    periods: { current: { to: "2026-11-05" } },
    clients: { connected: true, count: 2 },
  }));
  const db = {
    from: () => {
      let update: Row | null = null,
        inserted: Row | null = null;
      const matches: Array<(r: Row) => boolean> = [];
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          matches.push((r) => r[key] === value);
          return q;
        },
        is: (key: string, value: unknown) => {
          matches.push((r) => r[key] === value);
          return q;
        },
        neq: (key: string, value: unknown) => {
          matches.push((r) => r[key] !== value);
          return q;
        },
        update: (value: Row) => {
          update = value;
          return q;
        },
        upsert: (value: Row) => {
          inserted = value;
          return q;
        },
        maybeSingle: async () => {
          if (inserted)
            row = {
              id: "report-id",
              updated_at: `v${version++}`,
              send_claim_id: null,
              observations_md: "",
              ...inserted,
            };
          if (!row || !matches.every((match) => match(row!)))
            return { data: null, error: null };
          if (update) row = { ...row, ...update, updated_at: `v${version++}` };
          return { data: { ...row }, error: null };
        },
      };
      return q;
    },
  };
  class OpsError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  }
  const require = (name: string) => {
    if (name === "node:crypto") return { randomUUID: () => "claim-id" };
    if (name.includes("supabase/admin")) return { createAdminClient: () => db };
    if (name === "./tasks")
      return { OpsError, uuid: (v: string) => v, record: (v: unknown) => v };
    if (name === "./report-data")
      return {
        gatherReportData: gather,
        reportPeriods: () => ({
          week_start: "2026-11-02",
          current: { to: "2026-11-05" },
        }),
      };
    if (name === "./notify") return { notifyOpsAdmins: vi.fn() };
    if (name.includes("resend"))
      return {
        sendOpsReportEmail: vi.fn(() => {
          throw Error("Must never send during draft preparation");
        }),
      };
    throw Error(`Unexpected dependency: ${name}`);
  };
  const m = {
    exports: {} as Record<string, (...args: unknown[]) => Promise<Row>>,
  };
  new Function("require", "module", "exports", code)(require, m, m.exports);
  return { api: m.exports, gather, row: () => row };
}
const draft = {
  id: "report-id",
  week_start: "2026-11-02",
  updated_at: "original",
  status: "draft",
  send_claim_id: null,
  narrative_md: "",
  generated_narrative_md: "",
  observations_md: "Eimear's notes",
  data: { periods: { current: { to: "2026-11-03" } } },
};
afterEach(() => vi.unstubAllGlobals());
describe("Codex prepares reports; portal stores and reviews", () => {
  it("gathers figures without any model request and starts with empty text", async () => {
    const fetch = vi.fn(() => {
      throw Error("No provider request expected");
    });
    vi.stubGlobal("fetch", fetch);
    const h = harness();
    const r = await h.api.createReportDraft();
    expect(h.gather).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(r.narrative_md).toBe("");
    expect(r.status).toBe("draft");
  });
  it("saves prepared text as an unapproved draft, preserving observations", async () => {
    const h = harness(draft);
    const r = await h.api.submitReportDraft(draft.id, {
      expected_updated_at: "original",
      narrative_md: "Codex prepared report",
    });
    expect(r.narrative_md).toBe("Codex prepared report");
    expect(r.generated_narrative_md).toBe(r.narrative_md);
    expect(r.observations_md).toBe("Eimear's notes");
    expect(r.status).toBe("draft");
    expect(r.reviewed_by).toBeNull();
  });
  it("rejects a stale submission without modifying the report", async () => {
    const h = harness(draft);
    await expect(
      h.api.submitReportDraft(draft.id, {
        expected_updated_at: "old",
        narrative_md: "Old draft",
      }),
    ).rejects.toThrow("Report changed");
    expect(h.row()?.narrative_md).toBe("");
  });
  it("does not overwrite a person's edits or a reviewed report", async () => {
    for (const current of [
      { ...draft, narrative_md: "Human edits" },
      { ...draft, status: "reviewed" },
      { ...draft, status: "sent" },
      { ...draft, send_claim_id: "sending" },
    ]) {
      const h = harness(current);
      await expect(
        h.api.submitReportDraft(draft.id, {
          expected_updated_at: "original",
          narrative_md: "Replacement",
        }),
      ).rejects.toThrow();
      expect(h.row()).toEqual(current);
    }
  });
  it("refreshes figures without replacing text and requires review again", async () => {
    const h = harness({
      ...draft,
      status: "reviewed",
      narrative_md: "Reviewed text",
      generated_narrative_md: "Reviewed text",
    });
    const r = await h.api.createReportDraft();
    expect(r.narrative_md).toBe("Reviewed text");
    expect(r.observations_md).toBe("Eimear's notes");
    expect(r.status).toBe("draft");
    expect(r.data?.narrative_review_required).toBe(true);
  });
  it("cannot mark an empty report reviewed", async () => {
    await expect(
      harness(draft).api.updateReport(
        draft.id,
        { action: "review", expected_updated_at: "original" },
        "admin-id",
      ),
    ).rejects.toThrow("Add the report text");
  });
  it("does not accept approval or send instructions in a Codex draft submission", async () => {
    await expect(
      harness(draft).api.submitReportDraft(draft.id, {
        expected_updated_at: "original",
        narrative_md: "Prepared",
        action: "send",
      }),
    ).rejects.toThrow("Only prepared report text");
  });
});
