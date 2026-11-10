import { sign } from "node:crypto";
import { ContentPackError, contentResponseBytes } from "./content-pack";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
/** Write access is still limited by sharing: the reader can only edit files explicitly shared with it as Editor. */
const WRITE_SCOPE = "https://www.googleapis.com/auth/drive";
const FILES_URL = "https://www.googleapis.com/drive/v3/files/";
const idPattern = /^[A-Za-z0-9_-]{10,200}$/;

export type DriveConnection = {
  accessToken: string;
  allowedFileIds: string[];
  serviceAccountEmail: string;
};

/** A dedicated identity, with Viewer access to explicit content files only. No user impersonation. */
export async function connectContentDrive(
  options: {
    credentials?: string;
    allowedFileIds?: string[];
    fetch?: typeof fetch;
    now?: Date;
    access?: "read" | "write";
  } = {},
): Promise<DriveConnection> {
  const raw =
    options.credentials ?? process.env.OPS_CONTENT_DRIVE_SERVICE_ACCOUNT_JSON;
  const allowedFileIds =
    options.allowedFileIds ??
    (process.env.OPS_CONTENT_DRIVE_FILE_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  if (!raw || !allowedFileIds.length)
    throw new ContentPackError(
      "The portal's read-only Drive connection still needs to be set up",
      409,
    );
  if (
    allowedFileIds.length > 20 ||
    allowedFileIds.some((id) => !idPattern.test(id)) ||
    raw.length > 32_768
  )
    throw new ContentPackError(
      "The Drive connection settings need checking",
      409,
    );
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new ContentPackError(
      "The Drive connection settings need checking",
      409,
    );
  }
  if (
    credentials?.type !== "service_account" ||
    typeof credentials.client_email !== "string" ||
    !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(
      credentials.client_email,
    ) ||
    typeof credentials.private_key !== "string"
  )
    throw new ContentPackError(
      "The Drive connection needs its dedicated service account",
      409,
    );
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: credentials.client_email,
    scope: options.access === "write" ? WRITE_SCOPE : READ_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  let assertion: string;
  try {
    assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url")}`;
  } catch {
    throw new ContentPackError("The Drive connection key needs checking", 409);
  }
  const response = await (options.fetch ?? fetch)(TOKEN_URL, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new ContentPackError(
      "Google could not authenticate the portal's Drive connection",
      502,
    );
  let token;
  try {
    token = JSON.parse(
      (await contentResponseBytes(response, 16_384)).toString("utf8"),
    );
  } catch {
    throw new ContentPackError(
      "Google returned an incomplete Drive connection",
      502,
    );
  }
  if (
    typeof token.access_token !== "string" ||
    !token.access_token ||
    token.access_token.length > 8192 ||
    token.token_type !== "Bearer" ||
    !Number.isFinite(token.expires_in) ||
    token.expires_in < 60
  )
    throw new ContentPackError(
      "Google returned an incomplete Drive connection",
      502,
    );
  return {
    accessToken: token.access_token,
    allowedFileIds,
    serviceAccountEmail: credentials.client_email,
  };
}

/** Only explicitly connected file IDs are readable. File grants hide parent folders in Drive's API. */
export async function verifyContentDriveFile(
  fileId: string,
  connection: DriveConnection,
  request: typeof fetch = fetch,
) {
  if (!idPattern.test(fileId) || !connection.allowedFileIds.includes(fileId))
    throw new ContentPackError(
      "This file has not been connected to Marc's portal",
      409,
    );
  const response = await request(
    `${FILES_URL}${encodeURIComponent(fileId)}?fields=id,name,mimeType,version,trashed,capabilities(canDownload,canEdit)&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new ContentPackError(
      "The portal cannot read the connected content file. Check its Viewer access",
      409,
    );
  const file = JSON.parse(
    (await contentResponseBytes(response, 32_768)).toString("utf8"),
  );
  if (
    file.id !== fileId ||
    file.trashed === true ||
    !["application/json", "text/plain"].includes(file.mimeType) ||
    file.capabilities?.canDownload !== true ||
    file.capabilities?.canEdit !== false
  )
    throw new ContentPackError(
      "The connected content file must be a readable JSON file shared as Viewer",
      409,
    );
  return {
    id: file.id as string,
    name: file.name as string,
    version: file.version as string,
  };
}

export async function verifyContentDriveAccess(
  connection: DriveConnection,
  request: typeof fetch = fetch,
) {
  const files = [];
  for (const id of connection.allowedFileIds)
    files.push(await verifyContentDriveFile(id, connection, request));
  return { mode: "shared_files", files };
}
