import { connectContentDrive } from "@/lib/ops/drive-connection";
import { contentResponseBytes } from "@/lib/ops/content-pack";
import { OpsError } from "@/lib/ops/tasks";
import { inboxFolder } from "./config";
import { currentMonthFolders } from "./matching";
import type { DriveFile } from "./types";
export const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const folderMime = "application/vnd.google-apps.folder";
export async function connectInbox() {
  const root = inboxFolder();
  if (!root) return null;
  return {
    root,
    connection: await connectContentDrive({
      allowedFileIds: [root],
      access: "read",
    }),
  };
}
export async function driveRead(url: string, token: string) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw new OpsError(
      "Drive could not read the shared folder or file. Check Viewer access.",
      502,
    );
  return r;
}
async function children(parent: string, token: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = "";
  do {
    const p = new URLSearchParams({
      q: `'${parent}' in parents and trashed = false`,
      fields:
        "nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime,modifiedTime)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    const value = JSON.parse(
      (
        await contentResponseBytes(
          await driveRead(`${DRIVE_FILES}?${p}`, token),
          2_000_000,
        )
      ).toString(),
    );
    if (!Array.isArray(value.files))
      throw new OpsError("Drive returned an incomplete folder listing", 502);
    files.push(
      ...value.files.map((f: DriveFile) => ({ ...f, parent, path: [] })),
    );
    pageToken = value.nextPageToken ?? "";
    if (files.length > 5000)
      throw new OpsError(
        "Folder is too large to map safely; narrow the inbox",
        409,
      );
  } while (pageToken);
  return files;
}
/** Map mode reads metadata only. Intake descends solely into current/next month folders. No shortcuts followed. */
export async function walkInbox(mode: "map" | "intake", now = new Date()) {
  const inbox = await connectInbox();
  if (!inbox) return { configured: false, files: [] as DriveFile[], token: "" };
  const token = inbox.connection.accessToken;
  const roots = await children(inbox.root, token);
  const files: DriveFile[] = roots.map((f) => ({ ...f, path: [f.name] }));
  const selected =
    mode === "map"
      ? roots.filter((f) => f.mimeType === folderMime)
      : currentMonthFolders(roots, now);
  const queue = selected.map((f) => ({
    id: f.id,
    path: [f.name],
    monthId: f.id,
  }));
  const seen = new Set<string>();
  const started = Date.now();
  while (queue.length) {
    if (Date.now() - started > 90000 || files.length > 5000)
      throw new OpsError(
        "Folder map exceeded its safe scan limit; no partial intake was saved",
        409,
      );
    const parent = queue.shift()!;
    if (seen.has(parent.id)) continue;
    seen.add(parent.id);
    for (const f of await children(parent.id, token)) {
      const item = {
        ...f,
        path: [...parent.path, f.name],
        monthId: parent.monthId,
      };
      files.push(item);
      if (f.mimeType === folderMime)
        queue.push({ id: f.id, path: item.path, monthId: parent.monthId });
    }
  }
  return {
    configured: true,
    files: mode === "intake" ? files.filter((f) => f.monthId) : files,
    token,
  };
}
export async function readCaption(file: DriveFile, token: string) {
  const url =
    file.mimeType === "application/vnd.google-apps.document"
      ? `${DRIVE_FILES}/${encodeURIComponent(file.id)}/export?mimeType=text%2Fplain`
      : `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media`;
  return (
    await contentResponseBytes(await driveRead(url, token), 100_000)
  ).toString("utf8");
}
