import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";

const nativeRequire = createRequire(import.meta.url);
type Row = Record<string, unknown> & { id: string };
type Fn = (...args: unknown[]) => unknown;
class OpsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const helpers = {
  OpsError,
  uuid: (value: unknown) => {
    if (typeof value !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
      throw new OpsError("Invalid id");
    return value;
  },
};
function load(path: string, dependencies: Record<string, unknown>) {
  const code = transformSync(readFileSync(new URL(path, import.meta.url), "utf8"), {
    loader: "ts", format: "cjs", target: "es2022",
  }).code;
  const loaded = { exports: {} as Record<string, Fn> };
  new Function("require", "module", "exports", code)((name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("node:")) return nativeRequire(name);
    throw Error(`Unexpected dependency ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

function harness() {
  const tables: Record<string, Row[]> = {
    client_profiles: [
      { id: uid(1), archived_at: null, business_name: "Synthetic A", created_at: "2026-01-01T00:00:00Z", user: { full_name: "Client A" }, last_login: null, last_checkin: null },
      { id: uid(2), archived_at: null, business_name: "Synthetic B", created_at: "2026-01-01T00:00:00Z", user: { full_name: "Client B" }, last_login: "2026-11-01T00:00:00Z", last_checkin: "2026-11-03T00:00:00Z" },
      { id: uid(3), archived_at: "2026-10-01T00:00:00Z", business_name: "Archived", user: { full_name: "Archived client" } },
    ],
    inbox_messages: [
      { id: uid(11), client_id: uid(1), sender_role: "client", message: "Question", read_by_admin: false, created_at: "2026-11-01T10:00:00Z" },
      { id: uid(12), client_id: uid(1), sender_role: "admin", message: "Answer", created_at: "2026-11-01T11:00:00Z" },
      { id: uid(13), client_id: uid(2), sender_role: "client", message: "Other client", read_by_admin: true, created_at: "2026-11-01T12:00:00Z" },
      { id: uid(14), client_id: uid(3), sender_role: "client", message: "Archived secret", created_at: "2026-11-01T13:00:00Z" },
    ],
    checkins: [
      { id: uid(21), client_id: uid(1), created_at: "2026-11-01T08:00:00Z", questions: "Question A", admin_reply: "Answer", replied_at: "2026-11-01T09:00:00Z", client_reply: "Follow-up", client_replied_at: "2026-11-01T10:00:00Z" },
      { id: uid(22), client_id: uid(1), created_at: "2026-11-02T08:00:00Z", questions: "Question B", admin_reply: null },
      { id: uid(23), client_id: uid(2), created_at: "2026-11-03T08:00:00Z", questions: "Other client", admin_reply: null },
    ],
    client_modules: [
      { id: uid(31), client_id: uid(1), module_id: uid(41), status: "locked", module: { title: "Module one" } },
      { id: uid(32), client_id: uid(2), module_id: uid(42), status: "completed", module: { title: "Other module" } },
    ],
    content_progress: [
      { id: uid(51), client_id: uid(1), content_id: uid(61), completed: true, completed_at: "2026-11-01T08:00:00Z", content: { title: "Lesson one", module_id: uid(41) } },
    ],
  };
  const calls: { table: string; operations: string[] }[] = [];
  const failTables = new Set<string>();
  const db = {
    from: (table: string) => {
      const operations: string[] = [];
      calls.push({ table, operations });
      const filters: ((row: Row) => boolean)[] = [];
      const orders: { key: string; ascending: boolean; nullsFirst: boolean }[] = [];
      let limit = Infinity;
      let single = false;
      const query = {
        select: (fields: string) => { operations.push(`select:${fields}`); return query; },
        is: (key: string, value: unknown) => {
          operations.push(`is:${key}`);
          filters.push((row) => key === "client.archived_at"
            ? tables.client_profiles.some((client) => client.id === row.client_id && client.archived_at === value)
            : row[key] === value);
          return query;
        },
        eq: (key: string, value: unknown) => { operations.push(`eq:${key}`); filters.push((row) => row[key] === value); return query; },
        gt: (key: string, value: string) => { operations.push(`gt:${key}`); filters.push((row) => String(row[key]) > value); return query; },
        order: (key: string, options: { ascending: boolean; nullsFirst?: boolean }) => {
          orders.push({ key, ascending: options.ascending, nullsFirst: options.nullsFirst ?? false });
          return query;
        },
        limit: (value: number) => { limit = value; return query; },
        maybeSingle: () => { single = true; return query; },
        then: (resolve: (result: unknown) => void) => {
          if (failTables.has(table)) return Promise.resolve(resolve({ data: null, error: { message: "DB unavailable" } }));
          const rows = tables[table].filter((row) => filters.every((filter) => filter(row))).sort((a, b) => {
            for (const { key, ascending, nullsFirst } of orders) {
              if (a[key] == null && b[key] != null) return nullsFirst ? -1 : 1;
              if (a[key] != null && b[key] == null) return nullsFirst ? 1 : -1;
              if (a[key] === b[key]) continue;
              const comparison = String(a[key]) < String(b[key]) ? -1 : 1;
              return ascending ? comparison : -comparison;
            }
            return 0;
          }).slice(0, limit);
          return Promise.resolve(resolve({ data: single ? rows[0] || null : rows, error: null }));
        },
      };
      return query;
    },
  };
  const api = load("../lib/ops/portal-monitor.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "./tasks": helpers,
  });
  const tokens = { portal: "portal-read-test-token-12345678901234567890", task: "tasks-read-test-token-123456789012345678900", legacy: "legacy-admin-test-token-1234567890123456789" };
  const scopeConfig = JSON.stringify([
    { id: "portal", sha256: createHash("sha256").update(tokens.portal).digest("hex"), scopes: ["portal:read"] },
    { id: "task", sha256: createHash("sha256").update(tokens.task).digest("hex"), scopes: ["tasks:read"] },
  ]);
  const scoped = load("../lib/ops/scoped-auth.ts", {
    "@/lib/env": { getEnv: (name: string) => name === "OPS_SCOPED_TOKENS_JSON" ? scopeConfig : tokens.legacy },
    "@/lib/rate-limit": { rateLimit: () => ({ success: true }) },
    "./tasks": helpers,
  });
  const deps = {
    "@/lib/ops/portal-monitor": api,
    "@/lib/ops/scoped-auth": scoped,
    "@/lib/ops/http": {
      respond: async (fn: () => Promise<unknown>) => {
        try { return Response.json(await fn()); }
        catch (e) { return Response.json({ error: (e as Error).message }, { status: e instanceof OpsError ? e.status : 500 }); }
      },
    },
  };
  const route = load("../app/api/ops/portal-clients/route.ts", deps);
  const detailRoute = load("../app/api/ops/portal-clients/[id]/[collection]/route.ts", deps);
  const request = (token?: keyof typeof tokens, query = "") => new Request(`https://portal.example.invalid/api/ops/portal-clients${query}`, {
    headers: token ? { authorization: `Bearer ${tokens[token]}` } : {},
  });
  return { api, calls, tables, failTables, route, detailRoute, request };
}
type Page = { clients: Row[]; items: Row[]; client: Row; conversation: { needs_reply: boolean | null }; coverage: { next_cursor: string | null; collection_complete_in_this_response: boolean; end_of_collection: boolean; has_more: boolean } };

describe("read-only Codex portal monitoring", () => {
  it("requires portal:read before any source read, with no broad-token fallback", async () => {
    const h = harness();
    for (const [token, status] of [[undefined, 401], ["task", 403], ["legacy", 401]] as const) {
      const result = await h.route.GET(h.request(token)) as Response;
      expect(result.status).toBe(status);
      expect(h.calls).toHaveLength(0);
    }
    expect((await h.route.GET(h.request("portal")) as Response).status).toBe(200);
    expect(Object.keys(h.route)).toEqual(["GET"]);
    expect(Object.keys(h.detailRoute)).toEqual(["GET"]);
  });
  it("pages every active client without claiming a partial page is the full roster", async () => {
    const h = harness();
    const first = await h.api.listPortalClients(new URLSearchParams("limit=1")) as Page;
    expect(first.clients.map((c) => c.id)).toEqual([uid(1)]);
    expect(first.clients[0]).toMatchObject({ last_recorded_activity_at: null, days_since_recorded_activity: null });
    expect(first.coverage).toMatchObject({ has_more: true, collection_complete_in_this_response: false, end_of_collection: false });
    const second = await h.api.listPortalClients(new URLSearchParams({ limit: "1", cursor: first.coverage.next_cursor! })) as Page;
    expect(second.clients.map((c) => c.id)).toEqual([uid(2)]);
    expect(second.clients[0]).toMatchObject({ last_recorded_activity_at: "2026-11-03T00:00:00.000Z" });
    expect(second.coverage).toMatchObject({ has_more: false, collection_complete_in_this_response: false, end_of_collection: true });
  });
  it("uses the current latest sender, even while paging older messages", async () => {
    const h = harness();
    const page = await h.api.readPortalCollection(uid(1), "messages", new URLSearchParams("limit=1")) as Page;
    expect(page.items.map((r) => r.id)).toEqual([uid(11)]);
    expect(page.conversation.needs_reply).toBe(false); // Old unread question was answered.
    const other = await h.api.readPortalCollection(uid(2), "messages", new URLSearchParams()) as Page;
    expect(other.items[0]).toMatchObject({ message: "Other client", read_by_admin: true });
    expect(other.conversation.needs_reply).toBe(true); // Read is not replied.
  });
  it("returns ambiguous message ordering as unknown instead of guessing", () => {
    const h = harness();
    expect(h.api.messageReplyState([
      { id: uid(1), sender_role: "client", created_at: "2026-11-01T10:00:00Z" },
      { id: uid(2), sender_role: "admin", created_at: "2026-11-01T10:00:00Z" },
    ])).toMatchObject({ needs_reply: null });
    expect(h.api.messageReplyState([{ id: uid(1), sender_role: "admin", created_at: null }])).toMatchObject({ needs_reply: null });
  });
  it("flags a client's follow-up after an admin answer, including older check-ins", async () => {
    const h = harness();
    const first = await h.api.readPortalCollection(uid(1), "checkins", new URLSearchParams("limit=1")) as Page;
    expect(first.items[0]).toMatchObject({ needs_reply: true, reason: "client_replied_after_admin" });
    const next = await h.api.readPortalCollection(uid(1), "checkins", new URLSearchParams({ limit: "1", cursor: first.coverage.next_cursor! })) as Page;
    expect(next.items[0]).toMatchObject({ needs_reply: true, reason: "no_admin_reply" });
    expect(next.coverage.end_of_collection).toBe(true);
    expect(h.api.checkinReplyState({ id: uid(1), admin_reply: "Answer", replied_at: null, created_at: "2026-01-01T00:00:00Z" })).toMatchObject({ needs_reply: null });
    expect(h.api.checkinReplyState({ id: uid(1), admin_reply: "Answer", replied_at: "2026-01-03T00:00:00Z", client_reply: "Earlier", client_replied_at: "2026-01-02T00:00:00Z", created_at: "2026-01-01T00:00:00Z" })).toMatchObject({ needs_reply: false });
  });
  it("binds collection reads to the requested active client and rejects archived clients", async () => {
    const h = harness();
    const data = await h.api.readPortalCollection(uid(1), "training", new URLSearchParams()) as Page;
    expect(data.items).toEqual([expect.objectContaining({ id: uid(31), recorded_status: "locked", title: "Module one" })]);
    expect(JSON.stringify(data)).not.toContain("Other module");
    const read = h.calls.find((call) => call.table === "client_modules")!;
    expect(read.operations).toContain("eq:client_id");
    expect(read.operations).toContain("is:client.archived_at");
    await expect(h.api.readPortalCollection(uid(3), "messages", new URLSearchParams())).rejects.toMatchObject({ status: 404 });
    const lessons = await h.api.readPortalCollection(uid(1), "lessons", new URLSearchParams()) as Page;
    expect(lessons.items[0]).toMatchObject({ recorded_completed: true, title: "Lesson one" });
  });
  it("exposes recorded routine-follow-up holds without hiding the client's unanswered message", async () => {
    const h = harness();
    h.tables.client_profiles[1].payment_status = "paused";
    const roster = await h.api.listPortalClients(new URLSearchParams()) as Page;
    expect(roster.clients.find((row) => row.id === uid(2)))
      .toMatchObject({ routine_follow_up: "paused_in_portal_records" });
    const messages = await h.api.readPortalCollection(uid(2), "messages", new URLSearchParams()) as Page;
    expect(messages.conversation.needs_reply).toBe(true);
    expect(messages.client.routine_follow_up).toBe("paused_in_portal_records");
    expect(messages.client).not.toHaveProperty("payment_status");
  });
  it("leaves impossible check-in reply dates uncertain rather than treating them as answered", () => {
    const h = harness();
    expect(h.api.checkinReplyState({
      id: uid(21), created_at: "2026-11-02T10:00:00Z", admin_reply: "Answer",
      replied_at: "2026-11-02T11:00:00Z", client_reply: "Follow-up", client_replied_at: "2026-11-01T10:00:00Z",
    })).toMatchObject({ needs_reply: null, reason: "reply_order_uncertain" });
  });
  it("rejects cross-client/cross-collection cursors and invalid limits", async () => {
    const h = harness();
    const first = await h.api.readPortalCollection(uid(1), "messages", new URLSearchParams("limit=1")) as Page;
    for (const [client, collection] of [[uid(2), "messages"], [uid(1), "checkins"]])
      await expect(h.api.readPortalCollection(client, collection, new URLSearchParams({ cursor: first.coverage.next_cursor! }))).rejects.toThrow("Invalid cursor");
    for (const limit of ["0", "101", "1.5", "no"])
      await expect(h.api.listPortalClients(new URLSearchParams({ limit }))).rejects.toThrow("limit");
  });
  it("fails the read rather than claiming an unavailable source has no issues", async () => {
    const h = harness();
    h.failTables.add("checkins");
    const response = await h.detailRoute.GET(h.request("portal"), { params: Promise.resolve({ id: uid(1), collection: "checkins" }) }) as Response;
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Portal source could not be read; coverage is incomplete" });
  });
});
