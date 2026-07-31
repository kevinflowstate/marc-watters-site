import { createHash } from "node:crypto";
import {
  hasExpectedFileSignature,
  safeDisplayFileName,
  uploadContentType,
  uploadExtension,
} from "./upload-security";

export const GROWTH_ENGINE_AUTOMATION_MAX_FILES = 8;
export const GROWTH_ENGINE_AUTOMATION_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const GROWTH_ENGINE_AUTOMATION_MAX_TOTAL_SIZE = 40 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "zip", "png", "jpg", "jpeg", "webp",
]);

export type AutomationAssetVisibility = "internal" | "client";

export interface PreparedAutomationAttachment {
  buffer: ArrayBuffer;
  fileName: string;
  title: string;
  extension: string;
  contentType: string;
  visibility: AutomationAssetVisibility;
}

export interface StagedAutomationAttachment {
  uploadedPath: string;
  fileName: string;
  title: string;
  visibility: AutomationAssetVisibility;
}

export interface AutomationAssetMetadata {
  id: string;
  storagePath: string;
  title: string;
  visibility: AutomationAssetVisibility;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function automationVisibility(value: unknown): AutomationAssetVisibility {
  return value === "client" || value === "client_on_publish" || value === true ? "client" : "internal";
}

function exactArrayBuffer(value: Buffer) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function decodeBase64(value: string) {
  const normalized = value.trim().replace(/^data:[^;]+;base64,/i, "").replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("An automated attachment contains invalid base64 data.");
  }
  return exactArrayBuffer(Buffer.from(normalized, "base64"));
}

export async function prepareAutomationAttachment(
  input: { buffer: ArrayBuffer; fileName: string; title?: unknown; visibility?: unknown },
): Promise<PreparedAutomationAttachment> {
  const fileName = safeDisplayFileName(input.fileName);
  const extension = uploadExtension(fileName);
  const contentType = uploadContentType(extension);
  if (!ALLOWED_EXTENSIONS.has(extension) || !contentType) {
    throw new Error(`${fileName} is not a supported Growth Engine file type.`);
  }
  if (input.buffer.byteLength <= 0 || input.buffer.byteLength > GROWTH_ENGINE_AUTOMATION_MAX_FILE_SIZE) {
    throw new Error(`${fileName} must be between 1 byte and 25MB.`);
  }
  if (!hasExpectedFileSignature(input.buffer, extension)) {
    throw new Error(`${fileName} does not match its file extension.`);
  }
  return {
    buffer: input.buffer,
    fileName,
    title: cleanText(input.title, 180) || fileName,
    extension,
    contentType,
    visibility: automationVisibility(input.visibility),
  };
}

export async function parseAutomationIntakeRequest(request: Request): Promise<{
  payload: JsonRecord;
  attachments: PreparedAutomationAttachment[];
  stagedAttachments: StagedAutomationAttachment[];
  attachmentsProvided: boolean;
}> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  const pending: Array<Promise<PreparedAutomationAttachment>> = [];
  const stagedAttachments: StagedAutomationAttachment[] = [];
  let payload: JsonRecord = {};
  let attachmentsProvided = false;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const rawPayload = form.get("payload") ?? form.get("report");
    if (typeof rawPayload !== "string") throw new Error("Multipart intake requires a JSON payload field.");
    try {
      payload = asRecord(JSON.parse(rawPayload));
    } catch {
      throw new Error("The multipart payload is not valid JSON.");
    }
    const files = [...form.getAll("files"), ...form.getAll("file")].filter((entry): entry is File => entry instanceof File);
    attachmentsProvided = files.length > 0 || Array.isArray(payload.attachments);
    const manifest = Array.isArray(payload.attachments) ? payload.attachments.map(asRecord) : [];
    files.forEach((file, index) => {
      const matching = manifest.find((item) => cleanText(item.fileName, 180) === file.name) || manifest[index] || {};
      pending.push(file.arrayBuffer().then((buffer) => prepareAutomationAttachment({
        buffer,
        fileName: file.name,
        title: matching.title,
        visibility: matching.visibility ?? matching.clientVisible,
      })));
    });
  } else {
    payload = asRecord(await request.json().catch(() => null));
    const encoded = Array.isArray(payload.attachments) ? payload.attachments.map(asRecord) : [];
    attachmentsProvided = Array.isArray(payload.attachments);
    for (const item of encoded) {
      const fileName = cleanText(item.fileName, 180);
      const base64 = cleanText(item.base64, 60 * 1024 * 1024);
      const uploadedPath = cleanText(item.uploadedPath, 600);
      if (!fileName || (!base64 && !uploadedPath)) {
        throw new Error("JSON attachments require fileName and either base64 or uploadedPath.");
      }
      if (uploadedPath) {
        stagedAttachments.push({
          uploadedPath,
          fileName: safeDisplayFileName(fileName),
          title: cleanText(item.title, 180) || safeDisplayFileName(fileName),
          visibility: automationVisibility(item.visibility ?? item.clientVisible),
        });
        continue;
      }
      pending.push(prepareAutomationAttachment({
        buffer: decodeBase64(base64),
        fileName,
        title: item.title,
        visibility: item.visibility ?? item.clientVisible,
      }));
    }
  }

  if (pending.length + stagedAttachments.length > GROWTH_ENGINE_AUTOMATION_MAX_FILES) {
    throw new Error(`A report can include at most ${GROWTH_ENGINE_AUTOMATION_MAX_FILES} files.`);
  }
  const attachments = await Promise.all(pending);
  const totalSize = attachments.reduce((total, attachment) => total + attachment.buffer.byteLength, 0);
  if (totalSize > GROWTH_ENGINE_AUTOMATION_MAX_TOTAL_SIZE) {
    throw new Error("Automated report files must be 40MB or smaller in total.");
  }
  return { payload, attachments, stagedAttachments, attachmentsProvided };
}

function digest(value: string | ArrayBuffer) {
  const hash = createHash("sha256");
  hash.update(typeof value === "string" ? value : Buffer.from(value));
  return hash.digest("hex");
}

export function automationStoragePrefix(clientId: string, sourceKey: string) {
  return `internal/${clientId}/automation/${digest(sourceKey).slice(0, 24)}`;
}

export function automationStagingPath(clientId: string, sourceKey: string, fileName: string) {
  const extension = uploadExtension(fileName);
  const nameKey = digest(`${sourceKey}:${safeDisplayFileName(fileName)}`).slice(0, 32);
  return `${automationStoragePrefix(clientId, sourceKey)}/staged/${nameKey}.${extension}`;
}

export function automationStoragePath(
  clientId: string,
  sourceKey: string,
  attachment: PreparedAutomationAttachment,
  index: number,
) {
  return `${automationStoragePrefix(clientId, sourceKey)}/${String(index + 1).padStart(2, "0")}-${digest(attachment.buffer).slice(0, 32)}.${attachment.extension}`;
}

export function automationAssetsFromMetadata(value: unknown): AutomationAssetMetadata[] {
  const metadata = asRecord(value);
  const assets = Array.isArray(metadata.automationAssets) ? metadata.automationAssets : [];
  return assets.flatMap((entry) => {
    const asset = asRecord(entry);
    const id = cleanText(asset.id, 80);
    const storagePath = cleanText(asset.storagePath, 500);
    if (!id || !storagePath) return [];
    return [{
      id,
      storagePath,
      title: cleanText(asset.title, 180) || "Growth Engine file",
      visibility: automationVisibility(asset.visibility),
    }];
  });
}

export function withAutomationAssets(
  current: unknown,
  assets: AutomationAssetMetadata[],
  source: string,
  sourceKey: string,
) {
  return {
    ...asRecord(current),
    source,
    sourceKey,
    receivedAt: new Date().toISOString(),
    automationAssets: assets,
  };
}

export function setAutomationAssetVisibility(
  current: unknown,
  assetId: string,
  visibility: AutomationAssetVisibility,
) {
  const metadata = asRecord(current);
  const assets = automationAssetsFromMetadata(metadata).map((asset) =>
    asset.id === assetId ? { ...asset, visibility } : asset
  );
  return { ...metadata, automationAssets: assets };
}

export function upsertReportAssetMetadata(
  current: unknown,
  asset: AutomationAssetMetadata,
) {
  const metadata = asRecord(current);
  const assets = automationAssetsFromMetadata(metadata);
  const existingIndex = assets.findIndex((item) => item.id === asset.id);
  if (existingIndex >= 0) {
    assets[existingIndex] = asset;
  } else {
    assets.push(asset);
  }
  return { ...metadata, automationAssets: assets };
}

export function withoutAutomationAsset(current: unknown, assetId: string) {
  const metadata = asRecord(current);
  return {
    ...metadata,
    automationAssets: automationAssetsFromMetadata(metadata).filter((asset) => asset.id !== assetId),
  };
}

export function clientVisibleAutomationAssetIds(value: unknown) {
  return automationAssetsFromMetadata(value)
    .filter((asset) => asset.visibility === "client")
    .map((asset) => asset.id);
}
