import { createHash } from "node:crypto";
import { OpsError, record } from "./tasks";
import type {
  ArtifactAction,
  ArtifactKind,
  ArtifactSnapshot,
  JsonObject,
  JsonValue,
} from "./action-types";

export function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 32) throw new OpsError("Artifact JSON is too deeply nested");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++)
      parts.push(canonicalJson(value[i], depth + 1));
    return `[${parts.join(",")}]`;
  }
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new OpsError("Unsupported artifact JSON key");
        return `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key], depth + 1)}`;
      })
      .join(",")}}`;
  }
  throw new OpsError("Artifact must contain finite JSON values only");
}
export function artifactHash(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
export function jsonObject(value: unknown): JsonObject {
  const object = record(value);
  const encoded = canonicalJson(object);
  if (Buffer.byteLength(encoded) > 262144)
    throw new OpsError("Artifact JSON exceeds 256 KiB");
  return JSON.parse(encoded) as JsonObject;
}
export function artifactSnapshot(input: unknown): ArtifactSnapshot {
  const b = record(input);
  if (
    !Number.isSafeInteger(b.version) ||
    Number(b.version) < 1 ||
    typeof b.manifest_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.manifest_hash)
  )
    throw new OpsError("Exact artifact version and manifest_hash required");
  return { version: Number(b.version), manifest_hash: b.manifest_hash };
}
export function prepareArtifact(input: unknown) {
  const b = record(input);
  const allowed = [
    "external_ref",
    "kind",
    "action",
    "title",
    "payload",
    "destination",
    "item_keys",
    "expected_version",
    "expected_manifest_hash",
  ];
  for (const key of Object.keys(b))
    if (!allowed.includes(key))
      throw new OpsError(`Unsupported artifact field: ${key}`);
  if (
    typeof b.external_ref !== "string" ||
    !b.external_ref.trim() ||
    b.external_ref.length > 300
  )
    throw new OpsError("Stable external_ref required (maximum 300 characters)");
  if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 300)
    throw new OpsError("Artifact title required (maximum 300 characters)");
  if (b.kind !== "content" && b.kind !== "lesson")
    throw new OpsError("Invalid artifact kind");
  const action: ArtifactAction =
    b.kind === "content" ? "schedule_content" : "publish_lesson";
  if (b.action !== action)
    throw new OpsError("Action does not match artifact kind");
  if (
    !Array.isArray(b.item_keys) ||
    b.item_keys.length < 1 ||
    b.item_keys.length > 100 ||
    b.item_keys.some(
      (k) => typeof k !== "string" || !k.trim() || k.length > 200,
    ) ||
    new Set(b.item_keys).size !== b.item_keys.length
  )
    throw new OpsError("Provide 1–100 unique nonempty item_keys");
  const document = {
    kind: b.kind as ArtifactKind,
    action,
    title: b.title.trim(),
    payload: jsonObject(b.payload),
    destination: jsonObject(b.destination),
    item_keys: [...b.item_keys] as string[],
  };
  const encoded = canonicalJson(document);
  if (Buffer.byteLength(encoded) > 262144)
    throw new OpsError("Complete artifact exceeds 256 KiB");
  const expected =
    b.expected_version == null && b.expected_manifest_hash == null
      ? null
      : artifactSnapshot({
          version: b.expected_version,
          manifest_hash: b.expected_manifest_hash,
        });
  return {
    external_ref: b.external_ref.trim(),
    ...document,
    manifest_hash: artifactHash(document),
    expected,
  };
}
export function receiptObject(input: unknown): JsonObject {
  const receipt = jsonObject(input);
  if (!Object.keys(receipt).length)
    throw new OpsError("Successful action requires a receipt");
  return receipt;
}
export function assertSnapshot(
  value: ArtifactSnapshot,
  expected: ArtifactSnapshot,
) {
  if (
    value.version !== expected.version ||
    value.manifest_hash !== expected.manifest_hash
  )
    throw new OpsError(
      "Artifact changed; review its current version before continuing",
      409,
    );
}
export function asJson(value: unknown): JsonValue {
  return JSON.parse(canonicalJson(value)) as JsonValue;
}
