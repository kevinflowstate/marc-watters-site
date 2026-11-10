import { connectContentDrive, type DriveConnection } from "./drive-connection";
import { ContentPackError, contentResponseBytes } from "./content-pack";
import { submitWorkspaceResult } from "./workspace-results";
import { OpsError } from "./tasks";

/**
 * Codex's scheduled jobs cannot hold the portal's bearer secret, so they hand results over
 * through one Drive folder instead. The portal's read-only service account lists that folder,
 * keeps only small JSON files created by Marc's own account, and saves each result through the
 * same validator and idempotent run-key function as POST /api/ops/workspace-results.
 * Nothing here approves, sends or changes anything outside ops_workspace_results.
 */

const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const idPattern = /^[A-Za-z0-9_-]{10,200}$/;
const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const MAX_FILE_BYTES = 65_536;
const MAX_FILES = 25;
const MAX_RESULTS_PER_FILE = 20;
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
export const DRIVE_RESULTS_ACTOR = "drive:results-folder";

type DriveFile = {
  id?: unknown;
  name?: unknown;
  mimeType?: unknown;
  modifiedTime?: unknown;
  size?: unknown;
  owners?: { emailAddress?: unknown }[];
  lastModifyingUser?: { emailAddress?: unknown };
  capabilities?: { canDownload?: unknown; canEdit?: unknown };
};

export type DriveResultsOutcome = {
  configured: boolean;
  files: number;
  saved: number;
  unchanged: number;
  conflicts: number;
  invalid: number;
  skipped: number;
};

type Options = {
  folderId?: string;
  ownerEmails?: string[];
  now?: Date;
  fetch?: typeof fetch;
  connect?: (options: { allowedFileIds: string[] }) => Promise<DriveConnection>;
  submit?: (input: unknown, actor: string) => Promise<{ received_at?: string }>;
};

function readConfig(options: Options) {
  const folderId = (
    options.folderId ?? process.env.OPS_RESULTS_DRIVE_FOLDER_ID ?? ""
  ).trim();
  const ownerEmails = (
    options.ownerEmails ??
    (process.env.OPS_RESULTS_DRIVE_OWNER_EMAILS ?? "").split(",")
  )
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!folderId && !ownerEmails.length) return null;
  if (
    !idPattern.test(folderId) ||
    !ownerEmails.length ||
    ownerEmails.length > 5 ||
    ownerEmails.some((email) => !emailPattern.test(email))
  )
    throw new OpsError("The Drive results folder settings need checking", 409);
  return { folderId, ownerEmails };
}

async function driveText(
  url: string,
  accessToken: string,
  request: typeof fetch,
  limit: number,
) {
  const response = await request(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return { ok: false as const, status: response.status };
  const text = (await contentResponseBytes(response, limit)).toString("utf8");
  return { ok: true as const, text };
}

export async function importDriveResults(
  options: Options = {},
): Promise<DriveResultsOutcome> {
  const outcome: DriveResultsOutcome = {
    configured: false,
    files: 0,
    saved: 0,
    unchanged: 0,
    conflicts: 0,
    invalid: 0,
    skipped: 0,
  };
  const config = readConfig(options);
  if (!config) return outcome;
  outcome.configured = true;
  const request = options.fetch ?? fetch;
  const submit = options.submit ?? submitWorkspaceResult;
  const now = options.now ?? new Date();

  let connection: DriveConnection;
  try {
    connection = await (options.connect ?? connectContentDrive)({
      allowedFileIds: [config.folderId],
    });
  } catch (error) {
    if (error instanceof ContentPackError)
      throw new OpsError(error.message, error.status);
    throw error;
  }

  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const query = [
    `'${config.folderId}' in parents`,
    "trashed = false",
    `modifiedTime > '${since}'`,
    "(mimeType = 'application/json' or mimeType = 'text/plain')",
  ].join(" and ");
  const listUrl =
    `${FILES_URL}?` +
    new URLSearchParams({
      q: query,
      fields:
        "files(id,name,mimeType,modifiedTime,size,owners(emailAddress),lastModifyingUser(emailAddress),capabilities(canDownload,canEdit))",
      orderBy: "modifiedTime",
      pageSize: String(MAX_FILES),
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
  const listed = await driveText(
    listUrl,
    connection.accessToken,
    request,
    262_144,
  );
  if (!listed.ok)
    throw new OpsError(
      "The portal cannot list the Drive results folder. Check it is shared with the portal's reader as Viewer",
      409,
    );
  let files: DriveFile[];
  try {
    const parsed = JSON.parse(listed.text);
    files = Array.isArray(parsed?.files) ? parsed.files : [];
  } catch {
    throw new OpsError("Google returned an unreadable folder listing", 502);
  }

  for (const file of files.slice(0, MAX_FILES)) {
    outcome.files += 1;
    const owner = file.owners?.[0]?.emailAddress;
    // Owner alone is not enough: someone else with edit access could rewrite Marc's file.
    const editor = file.lastModifyingUser?.emailAddress;
    const size = Number(file.size ?? 0);
    if (
      typeof file.id !== "string" ||
      !idPattern.test(file.id) ||
      typeof owner !== "string" ||
      !config.ownerEmails.includes(owner.toLowerCase()) ||
      typeof editor !== "string" ||
      !config.ownerEmails.includes(editor.toLowerCase()) ||
      file.capabilities?.canDownload !== true ||
      file.capabilities?.canEdit !== false ||
      !(size > 0 && size <= MAX_FILE_BYTES)
    ) {
      outcome.skipped += 1;
      continue;
    }
    let documents: unknown[];
    try {
      const body = await driveText(
        `${FILES_URL}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,
        connection.accessToken,
        request,
        MAX_FILE_BYTES,
      );
      if (!body.ok) {
        outcome.skipped += 1;
        continue;
      }
      const parsed = JSON.parse(body.text);
      documents = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      outcome.invalid += 1;
      continue;
    }
    if (!documents.length || documents.length > MAX_RESULTS_PER_FILE) {
      outcome.invalid += 1;
      continue;
    }
    for (const document of documents) {
      try {
        const saved = await submit(document, DRIVE_RESULTS_ACTOR);
        const receivedAt = Date.parse(String(saved?.received_at ?? ""));
        // A row received well before this sweep was already imported by an earlier one.
        if (Number.isFinite(receivedAt) && receivedAt < now.getTime() - 60_000)
          outcome.unchanged += 1;
        else outcome.saved += 1;
      } catch (error) {
        if (error instanceof OpsError && error.status === 409)
          outcome.conflicts += 1;
        else if (error instanceof OpsError && error.status === 400)
          outcome.invalid += 1;
        else throw error;
      }
    }
  }
  return outcome;
}
