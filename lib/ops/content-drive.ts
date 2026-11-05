import { createHash } from "node:crypto";
import {
  ContentPackError,
  contentResponseBytes,
  validateContentPack,
} from "./content-pack";

/** Imports a pinned JSON blob, never a Google Doc/share page. Caller binds the returned receipt to its artifact. */
export async function readDriveContentPack(
  input: { fileId: string; expectedVersion: string; expectedSha256: string },
  options: { accessToken?: string; fetch?: typeof fetch; now?: Date } = {},
) {
  if (
    !/^[A-Za-z0-9_-]{10,200}$/.test(input.fileId) ||
    !/^\d+$/.test(input.expectedVersion) ||
    !/^[a-f0-9]{64}$/.test(input.expectedSha256)
  )
    throw new ContentPackError(
      "Pinned Drive file ID, version and SHA-256 are required",
    );
  const token = options.accessToken?.trim();
  if (!token)
    throw new ContentPackError(
      "Scoped server-side Drive read access is not configured",
      409,
    );
  const request = options.fetch ?? fetch;
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}`;
  const headers = { Authorization: `Bearer ${token}` };
  async function metadata() {
    const r = await request(
      base +
        "?fields=id,mimeType,version,size,trashed,capabilities(canDownload)",
      {
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!r.ok)
      throw new ContentPackError(
        `Drive metadata unavailable (${r.status})`,
        502,
      );
    const m = JSON.parse(
      (await contentResponseBytes(r, 32_768)).toString("utf8"),
    );
    if (
      m.id !== input.fileId ||
      m.version !== input.expectedVersion ||
      m.trashed ||
      m.capabilities?.canDownload !== true ||
      !["application/json", "text/plain"].includes(m.mimeType) ||
      !Number.isFinite(Number(m.size)) ||
      Number(m.size) > 512_000
    )
      throw new ContentPackError(
        "Drive file changed or is not a readable bounded JSON blob",
        409,
      );
    return m;
  }
  await metadata();
  const r = await request(base + "?alt=media", {
    headers,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok)
    throw new ContentPackError(`Drive content unavailable (${r.status})`, 502);
  const bytes = await contentResponseBytes(r, 512_000);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== input.expectedSha256)
    throw new ContentPackError(
      "Drive manifest bytes do not match the selected version",
      409,
    );
  await metadata();
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ContentPackError("Drive manifest is not valid JSON");
  }
  return {
    pack: validateContentPack(value, { now: options.now }),
    source: { file_id: input.fileId, version: input.expectedVersion, sha256 },
  };
}
