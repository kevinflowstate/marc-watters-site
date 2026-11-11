import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { OpsError, record } from "./tasks";

/**
 * CBB lesson workbook PDF, drawn in the house style of the workbooks already attached to Marc's
 * lessons (e.g. "Does It Run Without You?", "Seal The Deal"): A4 portrait, blue CONSTRUCTION
 * BUSINESS BLUEPRINT kicker, bold uppercase title, "CBB Live Workbook · date" line, [Q1] sections
 * in blue, grey answer boxes with a blue left edge, tick lists, black-headed score tables and a
 * footer on every page. Codex supplies the structure; the portal owns the look.
 */

export type WorkbookBlock =
  | { type: "write"; question: string; hint?: string; lines?: number }
  | { type: "checklist"; question: string; hint?: string; items: string[] }
  | { type: "score"; question?: string; scale: string; items: string[]; bands?: { range: string; text: string }[] }
  | { type: "table"; question?: string; columns: string[]; rows: string[]; blank_rows?: number }
  | { type: "text"; text: string };

export type WorkbookSpec = {
  title: string;
  kicker?: string;
  date_line?: string;
  intro?: string;
  how_to_use?: string[];
  sections: { label?: string; title: string; prompt?: string; blocks: WorkbookBlock[] }[];
};

const BLUE = rgb(0x07 / 255, 0x73 / 255, 0xde / 255);
const BLACK = rgb(0, 0, 0);
const INK = rgb(0.13, 0.13, 0.13);
const MUTED = rgb(0.42, 0.42, 0.42);
const FILL = rgb(0.949, 0.949, 0.949);
const LINE = rgb(0.75, 0.75, 0.75);
const WHITE = rgb(1, 1, 1);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 54;
const WIDTH = A4[0] - MARGIN * 2;
const BOTTOM = 70;

/** Standard PDF fonts only cover WinAnsi; map common typography and drop anything else. */
export function pdfSafe(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[→⇒]/g, "->")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7e£©·é–—•…€\n]/g, "");
}

function str(value: unknown, name: string, max: number, optional = false) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new OpsError(`Workbook ${name} must be text up to ${max} characters`);
  return value.trim();
}
function list(value: unknown, name: string, maxItems: number, maxLen: number) {
  if (!Array.isArray(value) || !value.length || value.length > maxItems)
    throw new OpsError(`Workbook ${name} needs 1-${maxItems} entries`);
  return value.map((v, i) => str(v, `${name} ${i + 1}`, maxLen)!);
}

export function validateWorkbookSpec(input: unknown): WorkbookSpec {
  const b = record(input);
  const sections = b.sections;
  if (!Array.isArray(sections) || !sections.length || sections.length > 12)
    throw new OpsError("Workbook needs 1-12 sections");
  return {
    title: str(b.title, "title", 120)!,
    kicker: str(b.kicker, "kicker", 80, true),
    date_line: str(b.date_line, "date line", 120, true),
    intro: str(b.intro, "intro", 1200, true),
    how_to_use: b.how_to_use === undefined ? undefined : list(b.how_to_use, "how to use", 8, 200),
    sections: sections.map((raw, i) => {
      const s = record(raw);
      if (!Array.isArray(s.blocks) || !s.blocks.length || s.blocks.length > 12)
        throw new OpsError(`Workbook section ${i + 1} needs 1-12 blocks`);
      return {
        label: str(s.label, "section label", 12, true),
        title: str(s.title, "section title", 120)!,
        prompt: str(s.prompt, "section prompt", 800, true),
        blocks: s.blocks.map((rawBlock, j): WorkbookBlock => {
          const k = record(rawBlock);
          const where = `section ${i + 1} block ${j + 1}`;
          if (k.type === "write") {
            const lines = k.lines === undefined ? 4 : Number(k.lines);
            if (!Number.isInteger(lines) || lines < 1 || lines > 12) throw new OpsError(`${where}: lines must be 1-12`);
            return { type: "write", question: str(k.question, `${where} question`, 300)!, hint: str(k.hint, `${where} hint`, 300, true), lines };
          }
          if (k.type === "checklist")
            return { type: "checklist", question: str(k.question, `${where} question`, 300)!, hint: str(k.hint, `${where} hint`, 300, true), items: list(k.items, `${where} items`, 16, 120) };
          if (k.type === "score") {
            const bands = k.bands === undefined ? undefined : (Array.isArray(k.bands) && k.bands.length <= 6 ? k.bands : (() => { throw new OpsError(`${where}: up to 6 bands`); })()).map((band: unknown) => {
              const r = record(band);
              return { range: str(r.range, `${where} band range`, 20)!, text: str(r.text, `${where} band text`, 200)! };
            });
            return { type: "score", question: str(k.question, `${where} question`, 300, true), scale: str(k.scale, `${where} scale`, 120)!, items: list(k.items, `${where} items`, 15, 200), bands };
          }
          if (k.type === "table") {
            const blank = k.blank_rows === undefined ? 0 : Number(k.blank_rows);
            if (!Number.isInteger(blank) || blank < 0 || blank > 10) throw new OpsError(`${where}: blank_rows must be 0-10`);
            const columns = list(k.columns, `${where} columns`, 6, 40);
            return { type: "table", question: str(k.question, `${where} question`, 300, true), columns, rows: k.rows === undefined || (Array.isArray(k.rows) && k.rows.length === 0) ? [] : list(k.rows, `${where} rows`, 14, 60), blank_rows: blank };
          }
          if (k.type === "text") return { type: "text", text: str(k.text, `${where} text`, 1200)! };
          throw new OpsError(`${where}: unknown block type`);
        }),
      };
    }),
  };
}

type Ctx = { doc: PDFDocument; page: PDFPage; y: number; regular: PDFFont; bold: PDFFont; italic: PDFFont; title: string; pages: PDFPage[] };

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

function newPage(c: Ctx) {
  c.page = c.doc.addPage(A4);
  c.pages.push(c.page);
  c.y = A4[1] - MARGIN;
}
function ensure(c: Ctx, height: number) {
  if (c.y - height < BOTTOM) newPage(c);
}
function paragraph(c: Ctx, text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
  const font = opts.font ?? c.regular, size = opts.size ?? 10, lead = size * 1.4;
  const lines = wrap(text, font, size, opts.width ?? WIDTH);
  for (const line of lines) {
    ensure(c, lead);
    c.page.drawText(line, { x: opts.x ?? MARGIN, y: c.y - size, size, font, color: opts.color ?? INK });
    c.y -= lead;
  }
  c.y -= opts.gap ?? 4;
}

function header(c: Ctx, spec: WorkbookSpec) {
  c.page.drawText("CONSTRUCTION BUSINESS BLUEPRINT", { x: MARGIN, y: c.y - 9, size: 9, font: c.bold, color: BLUE });
  c.y -= 18;
  for (const line of wrap(spec.title.toUpperCase(), c.bold, 24, WIDTH)) {
    c.page.drawText(line, { x: MARGIN, y: c.y - 24, size: 24, font: c.bold, color: BLACK });
    c.y -= 28;
  }
  const dateLine = [spec.kicker ?? "CBB Live Workbook", spec.date_line].filter(Boolean).join("  •  ");
  paragraph(c, dateLine, { size: 10, color: MUTED, gap: 10 });
  if (spec.intro) paragraph(c, spec.intro, { size: 10.5, gap: 10 });
  if (spec.how_to_use?.length) {
    paragraph(c, "How to use this workbook", { font: c.bold, size: 11, color: BLACK, gap: 2 });
    for (const item of spec.how_to_use) {
      ensure(c, 14);
      c.page.drawText("•", { x: MARGIN, y: c.y - 10, size: 10, font: c.bold, color: BLUE });
      paragraph(c, item, { x: MARGIN + 12, width: WIDTH - 12, gap: 1 });
    }
    c.y -= 8;
  }
}

function question(c: Ctx, text?: string, hint?: string) {
  if (text) paragraph(c, text, { font: c.bold, size: 10.5, color: BLACK, gap: hint ? 1 : 5 });
  if (hint) paragraph(c, hint, { font: c.italic, size: 9, color: MUTED, gap: 5 });
}

function writeBox(c: Ctx, lines: number) {
  const h = 16 * lines + 8;
  ensure(c, h + 10);
  c.page.drawRectangle({ x: MARGIN, y: c.y - h, width: WIDTH, height: h, color: FILL });
  c.page.drawRectangle({ x: MARGIN, y: c.y - h, width: 3, height: h, color: BLUE });
  c.y -= h + 14;
}

function checklist(c: Ctx, items: string[]) {
  const colW = (WIDTH - 20) / 2;
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2).map((t) => wrap(t, c.regular, 9.5, colW - 18));
    const rows = Math.max(...pair.map((p) => p.length));
    ensure(c, rows * 13 + 6);
    pair.forEach((lines, k) => {
      const x = MARGIN + k * (colW + 20);
      c.page.drawRectangle({ x, y: c.y - 10, width: 8, height: 8, borderColor: BLUE, borderWidth: 1 });
      lines.forEach((line, n) => c.page.drawText(line, { x: x + 16, y: c.y - 9 - n * 13, size: 9.5, font: c.regular, color: INK }));
    });
    c.y -= rows * 13 + 6;
  }
  c.y -= 8;
}

function score(c: Ctx, block: Extract<WorkbookBlock, { type: "score" }>) {
  const scoreW = 56, rowPad = 7;
  const estimate = 40 + block.items.reduce((h, item) => h + wrap(item, c.regular, 9.5, WIDTH - scoreW - 34).length * 12 + rowPad * 2, 0) + 32 + (block.bands?.length ?? 0) * 14;
  if (estimate < A4[1] - MARGIN - BOTTOM) ensure(c, estimate);
  const headLines = wrap(block.scale, c.bold, 9, WIDTH - scoreW - 16);
  const headH = headLines.length * 12 + rowPad * 2;
  ensure(c, headH + 30);
  c.page.drawRectangle({ x: MARGIN, y: c.y - headH, width: WIDTH, height: headH, color: BLACK });
  headLines.forEach((line, n) => c.page.drawText(line, { x: MARGIN + 8, y: c.y - rowPad - 9 - n * 12, size: 9, font: c.bold, color: WHITE }));
  c.page.drawRectangle({ x: MARGIN + WIDTH - scoreW, y: c.y - headH, width: scoreW, height: headH, color: BLUE });
  c.page.drawText("Score", { x: MARGIN + WIDTH - scoreW + 14, y: c.y - rowPad - 9, size: 9, font: c.bold, color: WHITE });
  c.y -= headH;
  block.items.forEach((item, i) => {
    const lines = wrap(item, c.regular, 9.5, WIDTH - scoreW - 34);
    const h = lines.length * 12 + rowPad * 2;
    ensure(c, h);
    c.page.drawRectangle({ x: MARGIN, y: c.y - h, width: WIDTH, height: h, borderColor: LINE, borderWidth: 0.6 });
    c.page.drawLine({ start: { x: MARGIN + WIDTH - scoreW, y: c.y }, end: { x: MARGIN + WIDTH - scoreW, y: c.y - h }, thickness: 0.6, color: LINE });
    c.page.drawText(String(i + 1), { x: MARGIN + 8, y: c.y - rowPad - 9, size: 9.5, font: c.bold, color: BLUE });
    lines.forEach((line, n) => c.page.drawText(line, { x: MARGIN + 24, y: c.y - rowPad - 9 - n * 12, size: 9.5, font: c.regular, color: INK }));
    c.y -= h;
  });
  ensure(c, 24);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 24, width: WIDTH, height: 24, color: FILL, borderColor: LINE, borderWidth: 0.6 });
  c.page.drawText(`TOTAL (out of ${block.items.length * 5})`, { x: MARGIN + 8, y: c.y - 16, size: 9.5, font: c.bold, color: BLACK });
  c.y -= 32;
  for (const band of block.bands ?? []) {
    ensure(c, 14);
    c.page.drawText(pdfSafe(band.range), { x: MARGIN, y: c.y - 9.5, size: 9.5, font: c.bold, color: BLUE });
    paragraph(c, band.text, { x: MARGIN + 62, width: WIDTH - 62, size: 9.5, gap: 1 });
  }
  c.y -= 8;
}

function table(c: Ctx, block: Extract<WorkbookBlock, { type: "table" }>) {
  const cols = block.columns.length, first = Math.min(170, WIDTH * 0.32), rest = (WIDTH - first) / Math.max(1, cols - 1);
  const widths = block.columns.map((_, i) => (i === 0 ? first : rest));
  const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0));
  ensure(c, 22 + 22 * 2);
  c.page.drawRectangle({ x: MARGIN, y: c.y - 22, width: WIDTH, height: 22, color: BLACK });
  block.columns.forEach((col, i) => {
    const label = wrap(col.toUpperCase(), c.bold, 7.5, widths[i] - 8)[0] ?? "";
    c.page.drawText(label, { x: xs[i] + 5, y: c.y - 14, size: 7.5, font: c.bold, color: WHITE });
  });
  c.y -= 22;
  const rows = [...block.rows, ...Array(block.blank_rows ?? 0).fill("")];
  for (const row of rows) {
    ensure(c, 22);
    c.page.drawRectangle({ x: MARGIN, y: c.y - 22, width: WIDTH, height: 22, borderColor: LINE, borderWidth: 0.6 });
    xs.slice(1).forEach((x) => c.page.drawLine({ start: { x, y: c.y }, end: { x, y: c.y - 22 }, thickness: 0.6, color: LINE }));
    if (row) c.page.drawText(wrap(row, c.regular, 8.5, widths[0] - 10)[0] ?? "", { x: MARGIN + 5, y: c.y - 14, size: 8.5, font: c.regular, color: MUTED });
    c.y -= 22;
  }
  c.y -= 12;
}

function blockHeight(c: Ctx, block: WorkbookBlock): number {
  const q = (text?: string, hint?: string) =>
    (text ? wrap(text, c.bold, 10.5, WIDTH).length * 14.7 + 5 : 0) + (hint ? wrap(hint, c.italic, 9, WIDTH).length * 12.6 + 5 : 0);
  if (block.type === "write") return q(block.question, block.hint) + 16 * (block.lines ?? 4) + 22;
  if (block.type === "checklist") return q(block.question, block.hint) + Math.ceil(block.items.length / 2) * 19 + 8;
  if (block.type === "score")
    return q(block.question) + 40 + block.items.reduce((h, item) => h + wrap(item, c.regular, 9.5, WIDTH - 90).length * 12 + 14, 0) + 32 + (block.bands?.length ?? 0) * 14;
  if (block.type === "table") return q(block.question) + 22 * (1 + block.rows.length + (block.blank_rows ?? 0)) + 12;
  return wrap(block.text, c.regular, 10, WIDTH).length * 14 + 8;
}

export type WorkbookAssets = { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array; logoPng?: Uint8Array };

/** Arimo (Apache 2.0, metric-compatible with Arial, which Marc's Word workbooks use) is embedded so every viewer shows the same type. */
export async function loadWorkbookAssets(root = process.cwd()): Promise<WorkbookAssets> {
  const font = (name: string) => readFile(path.join(root, "assets", "fonts", name));
  const [regular, bold, italic, logoPng] = await Promise.all([
    font("Arimo-Regular.ttf"),
    font("Arimo-Bold.ttf"),
    font("Arimo-Italic.ttf"),
    readFile(path.join(root, "public", "icon-192x192.png")).catch(() => undefined),
  ]);
  return { regular, bold, italic, logoPng };
}

export async function renderWorkbookPdf(
  input: unknown,
  opts: { assets?: WorkbookAssets; logoPng?: Uint8Array; createdAt?: Date } = {},
) {
  const spec = validateWorkbookSpec(input);
  const doc = await PDFDocument.create();
  doc.setTitle(`${spec.title} - Workbook`);
  doc.setAuthor("Construction Business Blueprint");
  doc.setCreator("CBB Portal");
  doc.setProducer("CBB Portal");
  if (opts.createdAt) {
    doc.setCreationDate(opts.createdAt);
    doc.setModificationDate(opts.createdAt);
  }
  const c: Ctx = {
    doc,
    page: undefined as unknown as PDFPage,
    y: 0,
    regular: undefined as unknown as PDFFont,
    bold: undefined as unknown as PDFFont,
    italic: undefined as unknown as PDFFont,
    title: spec.title,
    pages: [],
  };
  if (opts.assets) {
    doc.registerFontkit(fontkit);
    c.regular = await doc.embedFont(opts.assets.regular, { subset: false });
    c.bold = await doc.embedFont(opts.assets.bold, { subset: false });
    c.italic = await doc.embedFont(opts.assets.italic, { subset: false });
  } else {
    c.regular = await doc.embedFont(StandardFonts.Helvetica);
    c.bold = await doc.embedFont(StandardFonts.HelveticaBold);
    c.italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  }
  newPage(c);
  const logoPng = opts.logoPng ?? opts.assets?.logoPng;
  if (logoPng) {
    const logo = await doc.embedPng(logoPng);
    c.page.drawImage(logo, { x: A4[0] - MARGIN - 34, y: A4[1] - MARGIN - 34, width: 34, height: 34 });
  }
  header(c, spec);
  spec.sections.forEach((section, i) => {
    // Keep a section heading, its prompt and its whole first block together when they fit on one page.
    const first = section.blocks[0];
    const promptH = section.prompt ? wrap(section.prompt, c.regular, 10, WIDTH).length * 14 + 8 : 0;
    const keep = 40 + promptH + (first ? blockHeight(c, first) : 0);
    ensure(c, keep < A4[1] - MARGIN - BOTTOM ? keep : 120);
    const label = `[${section.label ?? `Q${i + 1}`}]`;
    c.page.drawText(pdfSafe(label), { x: MARGIN, y: c.y - 13, size: 13, font: c.bold, color: BLUE });
    const labelW = c.bold.widthOfTextAtSize(pdfSafe(label), 13) + 8;
    const titleLines = wrap(section.title, c.bold, 13, WIDTH - labelW);
    titleLines.forEach((line, n) => c.page.drawText(line, { x: MARGIN + labelW, y: c.y - 13 - n * 17, size: 13, font: c.bold, color: BLUE }));
    c.y -= titleLines.length * 17 + 6;
    if (section.prompt) paragraph(c, section.prompt, { size: 10, gap: 8 });
    for (const block of section.blocks) {
      // A question never sits at the foot of a page with its answer area on the next.
      const h = blockHeight(c, block);
      if (h < A4[1] - MARGIN - BOTTOM) ensure(c, h);
      if (block.type === "write") {
        ensure(c, 30 + 16 * (block.lines ?? 4));
        question(c, block.question, block.hint);
        writeBox(c, block.lines ?? 4);
      } else if (block.type === "checklist") {
        question(c, block.question, block.hint);
        checklist(c, block.items);
      } else if (block.type === "score") {
        question(c, block.question);
        score(c, block);
      } else if (block.type === "table") {
        question(c, block.question);
        table(c, block);
      } else paragraph(c, block.text, { size: 10, gap: 8 });
    }
    c.y -= 6;
  });
  const footer = pdfSafe(`Construction Business Blueprint  |  ${spec.title}  |  `);
  c.pages.forEach((page, i) => {
    page.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: A4[0] - MARGIN, y: 44 }, thickness: 0.5, color: LINE });
    const text = `${footer}${i + 1}`;
    const w = c.regular.widthOfTextAtSize(text, 8);
    page.drawText(text, { x: (A4[0] - w) / 2, y: 30, size: 8, font: c.regular, color: MUTED });
  });
  return { bytes: await doc.save(), pages: c.pages.length, spec };
}
