import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import type {
  LessonPublicationDeps,
  LessonPublicationManifest,
  LessonMediaVerification,
  LessonPublicationReceipt,
} from "../lib/ops/lesson-publication";

class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function record(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new OpsError("JSON object required");
  return input;
}
function uuid(input: unknown) {
  if (
    typeof input !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input,
    )
  )
    throw new OpsError("Valid id required");
  return input;
}
function load(path: string, imports: Record<string, unknown>) {
  const code = transformSync(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const m = { exports: {} as Record<string, (...args: unknown[]) => unknown> };
  new Function("require", "module", "exports", code)(
    (name: string) => {
      if (!(name in imports)) throw Error(`Unexpected dependency ${name}`);
      return imports[name];
    },
    m,
    m.exports,
  );
  return m.exports;
}
const mp4 = load("../lib/ops/publication-mp4.ts", {
  "node:crypto": { createHash },
  "./tasks": { OpsError },
});
const api = load("../lib/ops/lesson-publication.ts", {
  "@/lib/supabase/admin": {
    createAdminClient: () => {
      throw Error("No database call expected");
    },
  },
  "@/lib/env": { getEnv: () => undefined },
  "./tasks": { OpsError, record, uuid },
  "./publication-mp4": mp4,
});
const media = readFileSync(
  new URL(
    "../fixtures/lesson-publication/verified-synthetic.mp4",
    import.meta.url,
  ),
);
const digest = createHash("sha256").update(media).digest("hex");
const id = "11111111-1111-4111-8111-111111111111";
const claim = "22222222-2222-4222-8222-222222222222";
const object = {
  object_id: id,
  storage_path: "approved/synthetic-v1.mp4",
  updated_at: "2026-11-05T12:00:00.000Z",
  etag: "synthetic",
  bytes: media.length,
  mime_type: "video/mp4",
};
const verification: LessonMediaVerification = {
  ...object,
  id,
  sha256: digest,
  duration_s: 1,
  verified_by: id,
  verified_at: "2026-11-05T12:00:00.000Z",
};
const manifest: LessonPublicationManifest = {
  schema_version: 1,
  lesson_ref: "lesson:synthetic",
  version: 1,
  mode: "draft",
  module_id: id,
  title: "Synthetic lesson",
  summary_md: "A test lesson.",
  workbook_md: "One test question.",
  media: {
    verification_id: id,
    storage_path: object.storage_path,
    sha256: digest,
  },
};
function deps(
  overrides: Partial<LessonPublicationDeps> = {},
): LessonPublicationDeps {
  return {
    object: vi.fn(async () => ({ ...object })),
    signedUrl: vi.fn(async () => "https://private.example.test/synthetic"),
    readMedia: vi.fn(
      async () =>
        new Response(media, {
          headers: { "content-length": String(media.length) },
        }),
    ),
    saveVerification: vi.fn(async (value) => ({ ...verification, ...value })),
    verification: vi.fn(async () => verification),
    publication: vi.fn(async () => ({
      media_verification_id: id,
      media_sha256: digest,
    })),
    module: vi.fn(async () => ({
      id,
      title: "Private module",
      is_published: false,
      content_count: 0,
    })),
    publish: vi.fn(
      async () =>
        ({ artifact_id: id, content_id: claim }) as LessonPublicationReceipt,
    ),
    enabled: () => false,
    ...overrides,
  };
}

describe("approved lesson publication", () => {
  it("streams and hashes an actual synthetic MP4 with video/audio metadata", async () => {
    const d = deps();
    const result = (await api.verifyStoredLessonMedia(
      { storage_path: object.storage_path, expected_sha256: digest },
      id,
      d,
    )) as {
      verification: LessonMediaVerification;
      playback_review_required: boolean;
    };
    expect(result.verification.sha256).toBe(digest);
    expect(result.verification.duration_s).toBeCloseTo(1, 1);
    expect(result.playback_review_required).toBe(true);
    expect(d.saveVerification).toHaveBeenCalledOnce();
  });
  it("handles box headers split between stream chunks and requires an audio track", async () => {
    const split = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < media.length; i += 7)
          controller.enqueue(media.subarray(i, i + 7));
        controller.close();
      },
    });
    const inspected = (await mp4.inspectLessonMp4(
      new Response(split),
      media.length,
    )) as { sha256: string };
    expect(inspected.sha256).toBe(digest);
    const silent = Buffer.from(media);
    const handler = silent.indexOf(Buffer.from("soun"));
    expect(handler).toBeGreaterThan(0);
    silent.write("none", handler, "ascii");
    await expect(
      mp4.inspectLessonMp4(new Response(silent), silent.length),
    ).rejects.toThrow("video and audio");
  });
  it("does not trust the supplied hash or a changed stored object", async () => {
    const d = deps();
    await expect(
      api.verifyStoredLessonMedia(
        { storage_path: object.storage_path, expected_sha256: "0".repeat(64) },
        id,
        d,
      ),
    ).rejects.toThrow("hash does not match");
    expect(d.saveVerification).not.toHaveBeenCalled();
    const changing = deps({
      object: vi
        .fn()
        .mockResolvedValueOnce(object)
        .mockResolvedValueOnce({
          ...object,
          updated_at: "2026-11-05T12:01:00.000Z",
        }),
    });
    await expect(
      api.verifyStoredLessonMedia(
        { storage_path: object.storage_path, expected_sha256: digest },
        id,
        changing,
      ),
    ).rejects.toThrow("Stored media changed");
    expect(changing.saveVerification).not.toHaveBeenCalled();
  });
  it("rejects oversized media before obtaining its bytes", async () => {
    const d = deps({ object: async () => ({ ...object, bytes: 268435457 }) });
    await expect(
      api.verifyStoredLessonMedia(
        { storage_path: object.storage_path, expected_sha256: digest },
        id,
        d,
      ),
    ).rejects.toThrow("above 256 MiB");
    expect(d.readMedia).not.toHaveBeenCalled();
  });
  it("rejects corrupted/truncated media and never registers verification", async () => {
    for (const invalid of [
      Buffer.from("not a video"),
      media.subarray(0, media.length - 3),
    ]) {
      const d = deps({ readMedia: async () => new Response(invalid) });
      await expect(
        api.verifyStoredLessonMedia(
          { storage_path: object.storage_path, expected_sha256: digest },
          id,
          d,
        ),
      ).rejects.toThrow();
      expect(d.saveVerification).not.toHaveBeenCalled();
    }
  });
  it("requires the verified private path and an exact bounded manifest", () => {
    for (const path of [
      "https://drive.google.com/file.mp4",
      "source/synthetic.mp4",
      "approved/../secret.mp4",
      "approved//file.mp4",
    ]) {
      expect(() =>
        api.validateLessonPublicationManifest({
          ...manifest,
          media: { ...manifest.media, storage_path: path },
        }),
      ).toThrow();
    }
    expect(() =>
      api.validateLessonPublicationManifest({ ...manifest, approved: true }),
    ).toThrow("Unsupported");
    expect(() =>
      api.validateLessonPublicationManifest({ ...manifest, mode: "anything" }),
    ).toThrow();
  });
  it("previews an unpublished draft without publishing or requiring the flag", async () => {
    const d = deps({
      module: async () => ({
        id,
        title: "Private module",
        is_published: false,
        content_count: 2,
      }),
    });
    const result = (await api.previewLessonPublication(manifest, d)) as {
      dry_run: boolean;
      would_publish_module: boolean;
    };
    expect(result.dry_run).toBe(true);
    expect(result.would_publish_module).toBe(false);
    expect(d.publish).not.toHaveBeenCalled();
  });
  it("refuses stale media, published destinations and publication exposing other drafts", async () => {
    await expect(
      api.previewLessonPublication(
        manifest,
        deps({
          verification: async () => ({
            ...verification,
            sha256: "0".repeat(64),
          }),
        }),
      ),
    ).rejects.toThrow("does not match");
    await expect(
      api.previewLessonPublication(
        manifest,
        deps({ object: async () => ({ ...object, etag: "changed" }) }),
      ),
    ).rejects.toThrow("Stored media changed");
    await expect(
      api.previewLessonPublication(
        manifest,
        deps({
          module: async () => ({
            id,
            title: "Published",
            is_published: true,
            content_count: 0,
          }),
        }),
      ),
    ).rejects.toThrow("unpublished");
    await expect(
      api.previewLessonPublication(
        { ...manifest, mode: "publish" },
        deps({
          module: async () => ({
            id,
            title: "Other drafts",
            is_published: false,
            content_count: 1,
          }),
        }),
      ),
    ).rejects.toThrow("empty dedicated");
  });
  it("keeps publication off by default and hands only validated claims to atomic persistence", async () => {
    const d = deps();
    await expect(
      api.publishLessonArtifact(
        manifest,
        { artifact_id: id, claim_id: claim },
        d,
      ),
    ).rejects.toThrow("publication is disabled");
    expect(d.publish).not.toHaveBeenCalled();
    const enabled = deps({ enabled: () => true });
    await api.publishLessonArtifact(
      manifest,
      { artifact_id: id, claim_id: claim },
      enabled,
    );
    expect(enabled.publish).toHaveBeenCalledWith(manifest, {
      artifact_id: id,
      claim_id: claim,
    });
  });
  it("serves a checked private preview without requiring an unpublished module", async () => {
    const d = deps();
    await expect(api.getVerifiedLessonMediaPreview(id, d)).resolves.toEqual({
      url: "https://private.example.test/synthetic",
      verification,
    });
    expect(d.module).not.toHaveBeenCalled();
    const changed = deps({
      object: async () => ({ ...object, etag: "replacement" }),
    });
    await expect(
      api.getVerifiedLessonMediaPreview(id, changed),
    ).rejects.toThrow("Stored media changed");
    expect(changed.signedUrl).not.toHaveBeenCalled();
  });
  it("keeps old playback and blocks approved media replacement after publication", async () => {
    const d = deps();
    await api.assertPublishedLessonMediaCurrent(id, "source/legacy.mp4", d);
    expect(d.publication).not.toHaveBeenCalled();
    await api.assertPublishedLessonMediaCurrent(id, object.storage_path, d);
    expect(d.publication).toHaveBeenCalledWith(id);
    await expect(
      api.assertPublishedLessonMediaCurrent(
        id,
        object.storage_path,
        deps({ publication: async () => null }),
      ),
    ).rejects.toThrow("receipt is missing");
    await expect(
      api.assertPublishedLessonMediaCurrent(
        id,
        object.storage_path,
        deps({
          object: async () => ({
            ...object,
            updated_at: "2026-11-06T12:00:00.000Z",
          }),
        }),
      ),
    ).rejects.toThrow("Stored media changed");
  });
});
