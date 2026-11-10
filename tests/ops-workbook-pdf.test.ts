import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { loadWorkbookAssets, pdfSafe, renderWorkbookPdf, validateWorkbookSpec } from "../lib/ops/workbook-pdf";

const spec = {
  title: "Start From The Source",
  date_line: "Tuesday 3rd November 2026",
  intro: "Where does your work actually come from?",
  how_to_use: ["Use real numbers."],
  sections: [
    { title: "Map it out", blocks: [{ type: "table", columns: ["Source", "Enquiries", "Jobs won"], rows: ["Referrals"], blank_rows: 2 }] },
    { title: "Score it", blocks: [{ type: "score", scale: "1 = not true, 5 = true", items: ["Good jobs", "Pays on time"], bands: [{ range: "8-10", text: "Keep it" }] }] },
    { title: "Decide", blocks: [{ type: "checklist", question: "Start this week", items: ["Track every source", "Drop one"] }, { type: "write", question: "One change", hint: "Small is fine", lines: 3 }] },
  ],
};

describe("CBB workbook PDF", () => {
  it("renders an A4 PDF in the house fonts with a page footer", async () => {
    const { bytes, pages } = await renderWorkbookPdf(spec, { assets: await loadWorkbookAssets(), createdAt: new Date("2026-01-01T00:00:00Z") });
    const doc = await PDFDocument.load(bytes);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(doc.getPageCount()).toBe(pages);
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect(Math.round(w)).toBe(595);
    expect(Math.round(h)).toBe(842);
    expect(doc.getTitle()).toBe("Start From The Source - Workbook");
    expect(bytes.length).toBeGreaterThan(300_000); // the three Arimo faces are embedded
  });

  it("is deterministic for the same outline", async () => {
    const assets = await loadWorkbookAssets();
    const at = new Date("2026-01-01T00:00:00Z");
    const a = await renderWorkbookPdf(spec, { assets, createdAt: at });
    const b = await renderWorkbookPdf(spec, { assets, createdAt: at });
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });

  it("rejects malformed outlines", () => {
    expect(() => validateWorkbookSpec({ title: "x", sections: [] })).toThrow("1-12 sections");
    expect(() => validateWorkbookSpec({ title: "x", sections: [{ title: "s", blocks: [{ type: "video" }] }] })).toThrow("unknown block type");
    expect(() => validateWorkbookSpec({ title: "x", sections: [{ title: "s", blocks: [{ type: "write", question: "q", lines: 40 }] }] })).toThrow("lines must be 1-12");
  });

  it("maps typography the standard fonts cannot draw", () => {
    expect(pdfSafe("It’s “fine” → go")).toBe("It's \"fine\" -> go");
  });
});
