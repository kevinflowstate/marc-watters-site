import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkbookPdfRef } from "./lesson-publication";

/**
 * Marc attaches each Tuesday call's workbook to that call's event in the portal calendar before
 * he takes the call. When it is there, the lesson uses Marc's own PDF instead of a generated one.
 * The file is copied privately next to the lesson video (named by its fingerprint) so the normal
 * review and publish steps treat it exactly like any other workbook PDF.
 */

const BUCKET = "plan-documents";
const MAX_BYTES = 5_000_000;

export type CalendarWorkbook = { event_id: string; event_title: string; storage_path: string; name: string };

type Attachment = { url?: unknown; name?: unknown; type?: unknown };

/** "lesson:YYYY-MM-DD:slug" -> "YYYY-MM-DD" */
export function lessonDate(lessonRef: string) {
  const m = /^lesson:(\d{4}-\d{2}-\d{2}):/.exec(lessonRef);
  return m ? m[1] : null;
}

/** Only files in the portal's own calendar storage are accepted. */
export function calendarStoragePath(url: unknown, base = (getEnv("NEXT_PUBLIC_SUPABASE_URL") || "").trim()) {
  if (typeof url !== "string" || !base) return null;
  let u: URL, b: URL;
  try {
    u = new URL(url);
    b = new URL(base);
  } catch {
    return null;
  }
  const prefix = `/storage/v1/object/public/${BUCKET}/`;
  if (u.origin !== b.origin || !u.pathname.startsWith(prefix) || u.search) return null;
  const path = decodeURIComponent(u.pathname.slice(prefix.length));
  return /^[A-Za-z0-9._-]{1,200}\.pdf$/i.test(path) ? path : null;
}

export function pickCalendarWorkbook(
  events: { id: string; title: string; event_time: string | null; attachments: unknown; updated_at: string }[],
): CalendarWorkbook | null {
  const evening = events
    .filter((e) => /^(1[89]|20):/.test(String(e.event_time ?? "")))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  for (const e of evening) {
    const files = (Array.isArray(e.attachments) ? e.attachments : []) as Attachment[];
    for (const f of files) {
      const name = typeof f.name === "string" ? f.name : "";
      if (!(f.type === "pdf" || /\.pdf$/i.test(name))) continue;
      const storage_path = calendarStoragePath(f.url);
      if (!storage_path) continue;
      const clean = name.replace(/[^A-Za-z0-9 _.,()&'-]/g, "").replace(/\.+pdf$/i, "").trim().slice(0, 110) || "Workbook";
      return { event_id: e.id, event_title: String(e.title ?? "").slice(0, 200), storage_path, name: `${clean}.pdf` };
    }
  }
  return null;
}

export async function findCalendarWorkbook(lessonRef: string): Promise<CalendarWorkbook | null> {
  const date = lessonDate(lessonRef);
  if (!date) return null;
  const from = `${date}T00:00:00Z`;
  const to = new Date(Date.parse(from) + 86_400_000).toISOString();
  const r = await createAdminClient()
    .from("calendar_events")
    .select("id,title,event_time,attachments,updated_at")
    .eq("is_active", true)
    .gte("event_date", from)
    .lt("event_date", to)
    .limit(20);
  if (r.error) return null;
  return pickCalendarWorkbook((r.data || []) as never);
}

/** Copies the calendar PDF privately to lesson-media/workbooks/<sha256>.pdf. */
export async function storeCalendarWorkbook(found: CalendarWorkbook): Promise<WorkbookPdfRef> {
  const db = createAdminClient();
  const file = await db.storage.from(BUCKET).download(found.storage_path);
  if (file.error || !file.data) throw new Error("The calendar workbook could not be read");
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("The calendar workbook is empty or larger than 5 MB");
  if (Buffer.from(bytes.slice(0, 5)).toString("latin1") !== "%PDF-") throw new Error("The calendar workbook is not a PDF");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storage_path = `workbooks/${sha256}.pdf`;
  const up = await db.storage.from("lesson-media").upload(storage_path, bytes, { contentType: "application/pdf", upsert: false });
  if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error("The calendar workbook could not be saved");
  return { storage_path, sha256, bytes: bytes.length, name: found.name };
}
