import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
const source = readFileSync(
  new URL("../lib/ops/cuts.ts", import.meta.url),
  "utf8",
);
const code = transformSync(
  source.replace(/^import .*;$/gm, "").replaceAll("export ", ""),
  { loader: "ts", target: "es2022" },
).code;
const validate = new Function(
  "OpsError",
  "record",
  code + "; return validateCuts;",
)(Error, (value: unknown) => value);
const cut = (start_s: number, end_s: number) => ({
  start_s,
  end_s,
  reason: "housekeeping",
  confidence: 0.9,
  snippet: "fixture",
  keep: false,
});
describe("conservative lesson cuts", () => {
  it("rejects overlap, teaching-sized ambiguous bounds and too-short proposals", () => {
    expect(() => validate([cut(0, 7)], 120, true)).toThrow();
    expect(() => validate([cut(0, 15), cut(14, 25)], 120, true)).toThrow();
    expect(() => validate([cut(0, 121)], 120, true)).toThrow();
    expect(() =>
      validate([{ ...cut(0, 15), confidence: NaN }], 120, true),
    ).toThrow();
  });
  it("merges gaps under two seconds and respects human keep choices", () => {
    expect(validate([cut(0, 10), cut(11, 22)], 120, true)).toHaveLength(1);
    expect(
      validate([cut(0, 10), { ...cut(11, 22), keep: true }], 120, true),
    ).toHaveLength(2);
    expect(validate([], 120, true)).toEqual([]);
  });
  it("rejects full and near-total removal, including gaps merged by a proposal", () => {
    expect(() => validate([cut(0, 120)], 120)).toThrow(/playable/);
    expect(() => validate([cut(0, 119.95)], 120)).toThrow(/playable/);
    expect(() => validate([cut(0, 60), cut(61, 120)], 120, true)).toThrow(
      /playable/,
    );
    expect(validate([{ ...cut(0, 120), keep: true }], 120)).toHaveLength(1);
  });
});
