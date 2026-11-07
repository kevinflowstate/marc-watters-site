import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, it, expect, vi } from "vitest";
const source = readFileSync(
  new URL("../lib/ops/tasks.ts", import.meta.url),
  "utf8",
);
const code = transformSync(source, {
  loader: "ts",
  format: "cjs",
  target: "es2022",
}).code;
describe("approval notification revision", () => {
  it("keeps the key for metadata/receipts and notifies a generic proposal edit with its new revision", async () => {
    const notify = vi.fn<(...args: string[]) => Promise<void>>(async () => {}),
      rpc = vi.fn(),
      compiledModule = {
        exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
      };
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "approval",
      status: "awaiting_approval",
      title: "Synthetic approval",
      proposal_revision: 1,
      updated_at: "first",
    };
    const require = (name: string) =>
      name.includes("supabase/admin")
        ? { createAdminClient: () => ({ rpc }) }
        : name.includes("ops/notify")
          ? { notifyOpsAdmins: notify }
          : {
              areas: ["other"],
              statuses: ["open", "awaiting_approval", "approved", "done"],
              assignees: ["marc", "eimear"],
            };
    new Function("require", "module", "exports", code)(
      require,
      compiledModule,
      compiledModule.exports,
    );
    const task = {
      kind: "approval",
      area: "other",
      title: "Synthetic approval",
    };
    rpc.mockResolvedValueOnce({ data: row, error: null });
    await compiledModule.exports.createTask(task);
    rpc.mockResolvedValueOnce({
      data: { ...row, updated_at: "reassigned" },
      error: null,
    });
    await compiledModule.exports.updateTask(row.id, { assignee: "marc" });
    rpc.mockResolvedValueOnce({
      data: { ...row, updated_at: "receipt" },
      error: null,
    });
    await compiledModule.exports.attachOutput(row.id, {
      label: "Receipt",
      url: "/fixture/receipt",
    });
    rpc.mockResolvedValueOnce({
      data: { ...row, updated_at: "receipt" },
      error: null,
    });
    await compiledModule.exports.createTask(task);
    expect(new Set(notify.mock.calls.map((c) => c[3])).size).toBe(1);
    rpc.mockResolvedValueOnce({
      data: { ...row, proposal_revision: 2, updated_at: "revised" },
      error: null,
    });
    await compiledModule.exports.updateTask(row.id, {
      detail: "Revised proposal",
    });
    expect(notify.mock.calls.at(-1)?.[3]).toBe(`approval:${row.id}:2`);
    expect(notify).toHaveBeenCalledTimes(4);
  });
});
