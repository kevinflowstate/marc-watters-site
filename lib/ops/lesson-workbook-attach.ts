import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LessonPublicationManifest, LessonPublicationReceipt } from "./lesson-publication";
import { createTask, OpsError } from "./tasks";

/**
 * After an approved lesson is added to Training, attach its workbook PDF the same way Marc's
 * workbooks are attached: a file in the public training-resources bucket plus an entry in the
 * lesson's attachments. Idempotent by the PDF fingerprint. The lesson is already live when this
 * runs, so a failure never undoes it: it leaves Eimear a task to attach the file instead.
 */
export async function attachLessonWorkbook(
  manifest: LessonPublicationManifest,
  receipt: Pick<LessonPublicationReceipt, "content_id" | "title">,
) {
  const ref = manifest.workbook_pdf;
  if (!ref) return { attached: false, reason: "no_workbook" as const };
  try {
    const db = createAdminClient();
    const content = await db.from("module_content").select("id,attachments").eq("id", receipt.content_id).single();
    if (content.error || !content.data) throw new OpsError("Lesson not found for workbook", 404);
    const existing = Array.isArray(content.data.attachments) ? (content.data.attachments as Record<string, unknown>[]) : [];
    if (existing.some((a) => a && a.sha256 === ref.sha256)) return { attached: true, reason: "already_attached" as const };

    const file = await db.storage.from("lesson-media").download(ref.storage_path);
    if (file.error || !file.data) throw new OpsError("Workbook PDF could not be read", 503);
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const key = `${Date.now()}-${randomBytes(4).toString("hex").slice(0, 6)}.pdf`;
    const upload = await db.storage.from("training-resources").upload(key, bytes, { contentType: "application/pdf", upsert: false });
    if (upload.error) throw new OpsError("Workbook PDF could not be published", 503);
    const url = db.storage.from("training-resources").getPublicUrl(key).data.publicUrl;
    const entry = { id: randomUUID(), url, name: ref.name, size: `${Math.max(1, Math.round(ref.bytes / 1024))} KB`, type: "pdf", sha256: ref.sha256 };
    const saved = await db.from("module_content").update({ attachments: [...existing, entry] }).eq("id", receipt.content_id);
    if (saved.error) throw new OpsError("Workbook could not be attached", 503);
    return { attached: true, reason: "attached" as const };
  } catch {
    await createTask(
      {
        kind: "task",
        title: `${receipt.title} · attach the workbook PDF`,
        detail: "The lesson was added to Training, but its workbook PDF did not attach. Open the lesson in Training and attach the workbook from the lesson review.",
        area: "lessons",
        assignee: "eimear",
        source: "system",
      },
      "system",
    ).catch(() => undefined);
    return { attached: false, reason: "needs_attention" as const };
  }
}
