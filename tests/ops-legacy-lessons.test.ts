import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";

function load(path: string, require: (name: string) => unknown) {
  const code = transformSync(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      loader: "ts",
      format: "cjs",
      target: "es2022",
    },
  ).code;
  const m = {
    exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>>,
  };
  new Function("require", "module", "exports", code)(require, m, m.exports);
  return m.exports;
}

describe("standard Codex lesson workflow", () => {
  it.each(["ingest", "proposeCuts", "approveCuts", "draftLesson"])(
    "refuses legacy %s before touching data or providers",
    async (name) => {
      const database = vi.fn(() => {
        throw Error("Must not access database");
      });
      const api = load("../lib/ops/lessons.ts", (dependency) => {
        if (dependency === "@/lib/env") return { getEnv: () => undefined };
        if (dependency.includes("supabase/admin"))
          return { createAdminClient: database };
        if (dependency === "./tasks") return { OpsError: Error };
        return {};
      });
      await expect(api[name]("recording-id", [])).rejects.toThrow(
        "not enabled",
      );
      expect(database).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "signed intake only starts the hosted worker with explicit legacy opt-in: %s",
    async (legacy) => {
      const after = vi.fn();
      const receive = vi.fn(async () => ({
        id: "recording-id",
        status: "received",
      }));
      const api = load("../app/api/webhooks/fathom/route.ts", (dependency) => {
        if (dependency === "next/server") return { after };
        if (dependency === "@/lib/ops/http")
          return { respond: (run: () => unknown) => run() };
        if (dependency === "@/lib/ops/fathom")
          return { verifyFathom: () => true };
        if (dependency === "@/lib/ops/lessons")
          return { receiveRecording: receive, ingest: vi.fn() };
        if (dependency === "@/lib/ops/tasks") return { OpsError: Error };
        if (dependency === "@/lib/env")
          return {
            getEnv: (key: string) =>
              key === "FATHOM_API_KEY"
                ? "test-only"
                : legacy
                  ? "true"
                  : undefined,
          };
        throw Error(`Unexpected dependency: ${dependency}`);
      });
      await expect(
        api.POST(
          new Request("http://localhost/webhook", {
            method: "POST",
            body: "{}",
          }),
        ),
      ).resolves.toEqual({ id: "recording-id", status: "received" });
      expect(receive).toHaveBeenCalledOnce();
      expect(after).toHaveBeenCalledTimes(legacy ? 1 : 0);
    },
  );
});
