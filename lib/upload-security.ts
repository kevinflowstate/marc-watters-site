const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const ZIP_EXTENSIONS = new Set(["zip", "docx", "xlsx", "pptx"]);
const COMPOUND_DOCUMENT_EXTENSIONS = new Set(["doc", "xls", "ppt"]);

export function uploadExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

export function uploadContentType(extension: string) {
  return MIME_BY_EXTENSION[extension] || null;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function hasExpectedFileSignature(buffer: ArrayBuffer, extension: string) {
  const bytes = new Uint8Array(buffer.slice(0, 32));
  if (bytes.length === 0) return false;

  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === "jpg" || extension === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (extension === "webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  if (extension === "pdf") return ascii(bytes, 0, 5) === "%PDF-";
  if (ZIP_EXTENSIONS.has(extension)) return startsWith(bytes, [0x50, 0x4b]);
  if (COMPOUND_DOCUMENT_EXTENSIONS.has(extension)) {
    return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (extension === "csv") {
    const sample = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 4096)));
    return !sample.some((byte) =>
      byte === 0 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)
    );
  }
  return false;
}

export function safeDisplayFileName(fileName: string) {
  return fileName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "attachment";
}
