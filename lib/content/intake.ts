import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError } from "@/lib/ops/tasks";
import { env, inboxFolder } from "./config";
import { listPosts } from "./crm";
import { readCaption, walkInbox } from "./drive";
import {
  matchCaptions,
  replacementAction,
  type CaptionDocument,
} from "./matching";
import { syncReviewTask } from "./review-task";
import { nextSlots } from "./slots";
import { importOneVideo } from "./import";
import { loadCaptionDocs } from "./caption-pdf";
import { matchClips } from "./captions";
import type { Video } from "./types";
export async function allVideos(): Promise<Video[]> {
  const rows: Video[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const r = await createAdminClient()
      .from("content_videos")
      .select("*,content_video_posts(*)")
      .order("created_at")
      .order("id")
      .range(offset, offset + 999);
    if (r.error) throw new OpsError("Content queue could not be read", 502);
    rows.push(...(r.data as Video[]));
    if (r.data.length < 1000) return rows;
  }
  throw new OpsError("Content queue exceeds the safe read limit", 409);
}
export async function intake(now = new Date()) {
  if (!inboxFolder())
    return { configured: false, message: "Folder not connected yet" };
  const db = createAdminClient(),
    lease = randomUUID();
  const locked = await db
    .from("content_intake_state")
    .update({
      lease_id: lease,
      lease_until: new Date(Date.now() + 600000).toISOString(),
    })
    .eq("id", true)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("id")
    .maybeSingle();
  if (locked.error) throw new OpsError("Intake could not be claimed", 502);
  if (!locked.data)
    return { configured: true, message: "A folder check is already running" };
  try {
    const tree = await walkInbox("intake", now);
    const files = tree.files
      .filter((f) => f.mimeType.startsWith("video/"))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "en", { numeric: true }) ||
          (a.createdTime ?? "").localeCompare(b.createdTime ?? "") ||
          a.id.localeCompare(b.id),
      );
    const docs: CaptionDocument[] = [],
      warnings: string[] = [];
    for (const f of tree.files.filter(
      (f) =>
        f.path.slice(1, -1).some((p) => /caption/i.test(p)) &&
        ["text/plain", "application/vnd.google-apps.document"].includes(
          f.mimeType,
        ),
    )) {
      try {
        docs.push({
          id: f.id,
          name: f.name,
          monthId: f.monthId!,
          text: await readCaption(f, tree.token),
        });
      } catch {
        warnings.push(`Caption could not be read: ${f.name}`);
      }
    }
    const captions = matchCaptions(files, docs);
    warnings.push(...captions.warnings);
    // Killen Studios' caption docs are PDFs: read once each, then matched inside their episode folder.
    const pdfs = tree.files.filter(
      (f) =>
        f.path.slice(1, -1).some((p) => /caption/i.test(p)) &&
        f.mimeType === "application/pdf",
    );
    const pdfDocs = await loadCaptionDocs(pdfs, tree.token, warnings);
    const pdfMatches = matchClips(
      files.map((f) => ({ id: f.id, name: f.name, path: f.path, monthId: f.monthId })),
      pdfDocs,
    );
    const existing = await allVideos();
    const remote = await listPosts(
      now.toISOString(),
      new Date(now.getTime() + 29 * 86400000).toISOString(),
    );
    const occupied = [
      ...remote
        .map((p) => p.displayDate ?? p.scheduleDate)
        .filter((x): x is string => !!x),
      ...existing
        .filter((v) => v.status !== "skipped" && v.suggested_at)
        .map((v) => v.suggested_at!),
    ];
    let added = 0,
      replaced = 0;
    for (const file of files) {
      const old = existing.find((v) => v.drive_file_id === file.id);
      const action = replacementAction(old, file);
      if (action === "protected") {
        warnings.push(
          `Changed file kept unchanged because it is approved, skipped or importing: ${file.name}`,
        );
        continue;
      }
      const pdf = pdfMatches.get(file.id);
      const caption = captions.matches.get(file.id) ?? pdf?.caption;
      const title = captions.matches.has(file.id) ? null : (pdf?.title ?? null);
      if (action === "unchanged") {
        if (old && !old.approved_at) {
          // Only write when something changed, so an open review is not marked "Video changed" every hour.
          const place =
            (old.month_id ?? null) !== (file.monthId ?? null) ||
            (old.drive_path ?? []).join("/") !== file.path.join("/");
          const sidecar =
            !!caption &&
            old.caption_source !== "manual" &&
            (old.caption !== caption || (old.title ?? null) !== title);
          if (place || sidecar) {
            const updated = await db
              .from("content_videos")
              .update({
                drive_path: file.path,
                month_id: file.monthId ?? null,
                ...(sidecar ? { caption, caption_source: "sidecar", title } : {}),
                updated_at: new Date().toISOString(),
              })
              .eq("id", old.id)
              .eq("updated_at", old.updated_at)
              .is("approved_at", null);
            if (updated.error)
              throw new OpsError("Caption could not be saved", 502);
          }
        }
        continue;
      }
      const slot =
        old?.suggested_at ??
        nextSlots(
          1,
          occupied,
          now,
          env("OPS_CONTENT_POST_TIME") || "18:00",
        )[0] ??
        null;
      if (!slot)
        warnings.push(`No free date within the next 28 days: ${file.name}`);
      const data = {
        drive_file_id: file.id,
        drive_md5: file.md5Checksum ?? null,
        file_name: file.name,
        mime_type: file.mimeType,
        size_bytes: file.size ? Number(file.size) : null,
        status: action,
        media_url: null,
        media_file_id: null,
        failure_reason: null,
        suggested_at: slot,
        caption:
          old?.caption_source === "manual" ? old.caption : (caption ?? ""),
        caption_source:
          old?.caption_source === "manual"
            ? "manual"
            : caption
              ? "sidecar"
              : null,
        title: old?.caption_source === "manual" ? (old.title ?? null) : title,
        drive_path: file.path,
        month_id: file.monthId ?? null,
        updated_at: new Date().toISOString(),
      };
      const saved = old
        ? await db
            .from("content_videos")
            .update(data)
            .eq("id", old.id)
            .eq("updated_at", old.updated_at)
            .is("approved_at", null)
            .select("id")
        : await db
            .from("content_videos")
            .upsert(data, {
              onConflict: "drive_file_id",
              ignoreDuplicates: true,
            })
            .select("id");
      if (saved.error)
        throw new OpsError(
          "Video changed or a date was claimed during intake. Run the check again.",
          409,
        );
      if (saved.data?.length) {
        if (action === "new") added++;
        else replaced++;
        if (slot) occupied.push(slot);
      }
    }
    await syncReviewTask();
    const state = await db
      .from("content_intake_state")
      .update({ checked_at: new Date().toISOString(), warnings })
      .eq("id", true)
      .eq("lease_id", lease);
    if (state.error)
      throw new OpsError("Folder check warnings could not be saved", 502);
    const imported = await importOneVideo();
    return { configured: true, added, replaced, warnings, ...imported };
  } finally {
    await db
      .from("content_intake_state")
      .update({ lease_until: null, lease_id: null })
      .eq("id", true)
      .eq("lease_id", lease);
  }
}
