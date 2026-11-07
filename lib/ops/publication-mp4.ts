import { createHash } from "node:crypto";
import { OpsError } from "./tasks";

const MAX_MOOV_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_S = 8 * 60 * 60;
export const MAX_LESSON_VERIFY_BYTES = 256 * 1024 * 1024;

function boxes(buffer: Buffer) {
  const found: Array<{ type: string; payload: Buffer }> = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 8) throw new OpsError("Invalid MP4 metadata");
    let size = buffer.readUInt32BE(offset);
    let header = 8;
    if (size === 1) {
      if (buffer.length - offset < 16)
        throw new OpsError("Invalid MP4 metadata");
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER))
        throw new OpsError("Invalid MP4 metadata");
      size = Number(large);
      header = 16;
    } else if (size === 0) size = buffer.length - offset;
    if (size < header || offset + size > buffer.length)
      throw new OpsError("Invalid MP4 metadata");
    found.push({
      type: buffer.toString("ascii", offset + 4, offset + 8),
      payload: buffer.subarray(offset + header, offset + size),
    });
    offset += size;
  }
  return found;
}

function movieMetadata(moov: Buffer) {
  const children = boxes(moov);
  const mvhd = children.find((box) => box.type === "mvhd")?.payload;
  if (!mvhd || mvhd.length < 20 || ![0, 1].includes(mvhd[0]))
    throw new OpsError("MP4 duration is unavailable");
  const version = mvhd[0];
  if (version === 1 && mvhd.length < 32)
    throw new OpsError("Invalid MP4 duration");
  const timescale = mvhd.readUInt32BE(version === 1 ? 20 : 12);
  const duration =
    version === 1 ? Number(mvhd.readBigUInt64BE(24)) : mvhd.readUInt32BE(16);
  const durationS = duration / timescale;
  if (
    !Number.isFinite(durationS) ||
    durationS <= 0 ||
    durationS > MAX_DURATION_S
  )
    throw new OpsError(
      "MP4 duration must be positive and no longer than eight hours",
    );
  const handlers = children
    .filter((box) => box.type === "trak")
    .flatMap((track) =>
      boxes(track.payload)
        .filter((box) => box.type === "mdia")
        .flatMap((media) =>
          boxes(media.payload)
            .filter((box) => box.type === "hdlr" && box.payload.length >= 12)
            .map((box) => box.payload.toString("ascii", 8, 12)),
        ),
    );
  if (!handlers.includes("vide") || !handlers.includes("soun"))
    throw new OpsError("Lesson MP4 must contain video and audio tracks");
  return {
    duration_s: durationS,
    has_video: true as const,
    has_audio: true as const,
  };
}

/** Hash every byte while keeping only the MP4 metadata atom in memory. */
export async function inspectLessonMp4(
  response: Response,
  expectedBytes: number,
  maxBytes = MAX_LESSON_VERIFY_BYTES,
) {
  if (!response.ok || !response.body)
    throw new OpsError("Stored lesson media could not be read", 503);
  if (
    !Number.isSafeInteger(expectedBytes) ||
    expectedBytes <= 0 ||
    expectedBytes > maxBytes
  )
    throw new OpsError(
      "Lesson exceeds the bounded verification limit; use the separate media verification runtime",
      413,
    );
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) !== expectedBytes)
    throw new OpsError("Stored media size changed", 409);
  const hash = createHash("sha256");
  let total = 0;
  let header = Buffer.alloc(0);
  let current: { type: string; remaining: number; payload: Buffer[] } | null =
    null;
  let moov: Buffer | null = null;
  let hasFtyp = false;
  let hasMdat = false;
  const reader = response.body.getReader();
  try {
    while (true) {
      const read = await reader.read();
      if (read.done) break;
      const bytes = Buffer.from(read.value);
      total += bytes.length;
      if (total > maxBytes || total > expectedBytes)
        throw new OpsError("Stored media exceeds its verified size", 413);
      hash.update(bytes);
      let offset = 0;
      while (offset < bytes.length) {
        if (!current) {
          const need =
            header.length >= 8 && header.readUInt32BE(0) === 1 ? 16 : 8;
          const take = Math.min(need - header.length, bytes.length - offset);
          header = Buffer.concat([
            header,
            bytes.subarray(offset, offset + take),
          ]);
          offset += take;
          if (
            header.length < 8 ||
            (header.readUInt32BE(0) === 1 && header.length < 16)
          )
            continue;
          let size = header.readUInt32BE(0);
          const type = header.toString("ascii", 4, 8);
          if (size === 1) {
            const large = header.readBigUInt64BE(8);
            if (large > BigInt(maxBytes))
              throw new OpsError("MP4 box exceeds the verification limit", 413);
            size = Number(large);
          } else if (size === 0)
            size =
              expectedBytes - (total - bytes.length + offset - header.length);
          if (size < header.length || size > expectedBytes)
            throw new OpsError("Invalid MP4 box size");
          if (type === "moov" && (moov || size > MAX_MOOV_BYTES))
            throw new OpsError("Unsupported or oversized MP4 metadata", 413);
          if (type === "ftyp") hasFtyp = true;
          if (type === "mdat") hasMdat = true;
          current = { type, remaining: size - header.length, payload: [] };
          header = Buffer.alloc(0);
        }
        const take = Math.min(current.remaining, bytes.length - offset);
        if (current.type === "moov")
          current.payload.push(bytes.subarray(offset, offset + take));
        offset += take;
        current.remaining -= take;
        if (current.remaining === 0) {
          if (current.type === "moov") moov = Buffer.concat(current.payload);
          current = null;
        }
      }
    }
    if (total !== expectedBytes || current || header.length)
      throw new OpsError("Stored MP4 is truncated", 409);
    if (!hasFtyp || !hasMdat || !moov)
      throw new OpsError("A complete non-fragmented MP4 is required");
    return { sha256: hash.digest("hex"), bytes: total, ...movieMetadata(moov) };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
