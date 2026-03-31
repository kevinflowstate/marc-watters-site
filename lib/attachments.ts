import type { Attachment } from "@/lib/types";

export function normalizeAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];

  const normalized = raw
    .map((item, index): Attachment | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : "";
      const url = typeof record.url === "string" ? record.url : "";
      if (!name || !url) return null;

      const type = typeof record.type === "string" ? record.type : "other";
      const size = typeof record.size === "string" ? record.size : undefined;
      const id = typeof record.id === "string" ? record.id : `${url}-${index}`;

      return {
        id,
        name,
        url,
        type: isAttachmentType(type) ? type : "other",
        size,
      } satisfies Attachment;
    })
    .filter((item): item is Attachment => item !== null);

  return normalized;
}

export function guessAttachmentType(fileName: string, mimeType?: string): Attachment["type"] {
  const lower = fileName.toLowerCase();
  const mime = mimeType?.toLowerCase() || "";

  if (lower.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".csv") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv")
  ) {
    return "sheet";
  }
  if (
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".ppt") ||
    lower.endsWith(".pptx") ||
    mime.includes("word") ||
    mime.includes("presentation")
  ) {
    return "doc";
  }
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  return "other";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const display = value >= 10 || unitIndex === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${display} ${units[unitIndex]}`;
}

function isAttachmentType(value: string): value is Attachment["type"] {
  return ["pdf", "sheet", "doc", "image", "other"].includes(value);
}
