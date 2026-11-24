import { describe, expect, it } from "vitest";
import { summariseHubdocWeek } from "../lib/ops/hubdoc-week";

describe("weekly supplier receipt evidence", () => {
  const week = "2026-11-16";
  const daily = (day: number, count: number) => ({run_key: `hubdoc:2026-11-${day}:scheduled`, summary: `Hubdoc forwards: ${count}. Includes inspected sent copies.`, outcome: "complete"});
  it("distinguishes missing data, incomplete totals and a verified zero", () => {
    expect(summariseHubdocWeek([],week)).toMatchObject({forwarded:null,coverage:"missing"});
    expect(summariseHubdocWeek([daily(16,2), daily(16,2), daily(21,4),daily(23,4)],week)).toMatchObject({forwarded:2,recordedDays:1,coverage:"partial"});
    expect(summariseHubdocWeek([16,17,18,19,20].map(day=>daily(day,0)),week)).toMatchObject({forwarded:0,coverage:"complete"});
  });
  it("uses reconciled weekly evidence once and keeps destination receipt unverified", () => {
    const rec = {...daily(16,4),run_key:`hubdoc:${week}:week-reconciled`,outcome:"partial"};
    expect(summariseHubdocWeek([rec,daily(16,2)],week)).toMatchObject({forwarded:4,coverage:"partial",ingestion:"unverified"});
  });
  it("counts a weekday once, through today's cutoff, including a verified quiet day", () => {
    const rows = [daily(16,2),daily(16,2),daily(17,0),daily(18,9)];
    expect(summariseHubdocWeek(rows,week,"2026-11-17")).toMatchObject({forwarded:2,recordedDays:2,expectedDays:2,coverage:"complete"});
    expect(summariseHubdocWeek([daily(16,2)],week,"2026-11-17")).toMatchObject({forwarded:2,recordedDays:1,expectedDays:2,coverage:"partial"});
  });
  it("never reads failed, unstructured, or differently keyed rows as zero", () => {
    expect(summariseHubdocWeek([{...daily(16,4),outcome:"failed"},{...daily(17,4),summary:"Held four invoices."}],week)).toMatchObject({forwarded:null});
  });
});
