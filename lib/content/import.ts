import { createHash } from "node:crypto";
import { openAsBlob } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError } from "@/lib/ops/tasks";
import {
  assertSchedulingEnabled,
  schedulingEnabled,
  videoMaxBytes,
} from "./config";
import { accounts, CRM_API, crmHeaders, mediaUrl } from "./crm";
import { connectInbox, driveRead, DRIVE_FILES } from "./drive";
import type { Video } from "./types";
/** One file, disk-backed multipart; never buffer a 500 MB video in the function heap. */
export async function importOneVideo() {
  if (!schedulingEnabled())
    return { imported: false, reason: "Scheduling is switched off" };
  const db = createAdminClient();
  const next = await db
    .from("content_videos")
    .select("*")
    .in("status", ["new", "replaced"])
    .order("file_name")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (next.error) throw new OpsError("Video queue could not be read", 502);
  if (!next.data) return { imported: false };
  const video = next.data as Video;
  const claim = await db
    .from("content_videos")
    .update({ status: "importing", updated_at: new Date().toISOString() })
    .eq("id", video.id)
    .eq("updated_at", video.updated_at)
    .is("approved_at", null)
    .select("id")
    .maybeSingle();
  if (claim.error) throw new OpsError("Video import could not be claimed", 502);
  if (!claim.data) return { imported: false };
  let directory: string | undefined,
    attempted = false;
  try {
    const max = videoMaxBytes();
    if (!video.drive_md5 || !video.size_bytes || video.size_bytes > max)
      throw new OpsError(
        "Video has no checksum/size or exceeds the upload limit",
        409,
      );
    if (
      !["video/mp4", "video/quicktime", "video/mov", "video/webm"].includes(
        video.mime_type,
      )
    )
      throw new OpsError(
        "Export this video as MP4, MOV or WebM before importing",
        409,
      );
    const inbox = await connectInbox();
    if (!inbox) throw new OpsError("Folder not connected yet", 409);
    await accounts(); // Verifies Marc's location and configured user before the media write.
    directory = await mkdtemp(join(tmpdir(), "cbb-content-"));
    const path = join(directory, "video");
    const response = await driveRead(
      `${DRIVE_FILES}/${encodeURIComponent(video.drive_file_id)}?alt=media`,
      inbox.connection.accessToken,
    );
    if (!response.body) throw new OpsError("Drive returned no video", 502);
    const file = await open(path, "wx", 0o600);
    const hash = createHash("md5");
    let size = 0;
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > max)
          throw new OpsError("Video exceeds the upload limit", 409);
        hash.update(chunk);
        // FileHandle.write may be partial; writeFile consumes the complete chunk.
        await file.writeFile(chunk);
      }
    } finally {
      await file.close();
    }
    if (
      size !== Number(video.size_bytes) ||
      hash.digest("hex") !== video.drive_md5
    )
      throw new OpsError(
        "Drive video changed during import. Check for new videos again.",
        409,
      );
    const form = new FormData();
    form.set(
      "file",
      await openAsBlob(path, { type: video.mime_type }),
      video.file_name.replace(/[\r\n"\\]/g, "_"),
    );
    form.set("name", video.file_name);
    form.set("hosted", "false");
    const headers = crmHeaders();
    assertSchedulingEnabled();
    attempted = true;
    const upload = await fetch(CRM_API + "/medias/upload-file", {
      method: "POST",
      headers: {
        Authorization: headers.Authorization,
        Version: headers.Version,
      },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(180000),
    });
    if (!upload.ok)
      throw new OpsError(
        `Media upload returned ${upload.status}. Check the CRM before another upload.`,
        502,
      );
    const saved = await upload.json();
    if (typeof saved.fileId !== "string" || typeof saved.url !== "string")
      throw new OpsError("Media upload receipt is incomplete", 502);
    mediaUrl(saved.url);
    const r = await db
      .from("content_videos")
      .update({
        media_url: saved.url,
        media_file_id: saved.fileId,
        mime_type:
          video.mime_type === "video/quicktime" ? "video/mov" : video.mime_type,
        status: "ready",
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id)
      .eq("status", "importing");
    if (r.error) throw new OpsError("Upload receipt could not be saved", 502);
    return { imported: true, id: video.id };
  } catch (e) {
    const reason = attempted
      ? "Upload outcome needs checking in the CRM. Automatic upload retry is blocked."
      : e instanceof OpsError
        ? e.message
        : "Video could not be imported. Check Drive access and try a fresh scan.";
    const saved = await db
      .from("content_videos")
      .update({
        status: attempted ? "importing" : "failed",
        failure_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id);
    if (saved.error)
      throw new OpsError(
        "Import state could not be saved; refresh before retrying",
        502,
      );
    return { imported: false, id: video.id, reason };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
