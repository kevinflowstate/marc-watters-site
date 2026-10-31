import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
const source = readFileSync(
  new URL("../lib/ops/report-data.ts", import.meta.url),
  "utf8",
);
const code = transformSync(
  source.replace(/^import .*;$/gm, "").replaceAll("export ", ""),
  { loader: "ts", target: "es2022" },
).code;
describe("optional report statistics contract", () => {
  it("includes location query and connected profiles without external requests", async () => {
    const fetchMock = vi.fn(async (input: string, options?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname.endsWith("/accounts"))
        return Response.json({ accounts: [{ profileId: "fixture-profile" }] });
      if (url.pathname.endsWith("/statistics")) {
        expect(url.searchParams.get("locationId")).toBe("93GJEdsr0cT9el3OINXq");
        expect(options?.method).toBe("POST");
        expect(JSON.parse(String(options?.body)).profileIds).toEqual([
          "fixture-profile",
        ]);
        return Response.json({ results: { totals: { posts: 1 } } });
      }
      return Response.json({ posts: [] });
    });
    const social = new Function(
      "createAdminClient",
      "getEnv",
      "fetch",
      code + ";return social;",
    )(
      () => {
        throw new Error("Database not used");
      },
      () => "fixture-only-token",
      fetchMock,
    );
    const result = await social();
    expect(result.statistics.connected).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
