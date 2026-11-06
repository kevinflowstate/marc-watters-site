import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { artifactHash } from "../lib/ops/action-validation";
import { stageContentImage, readStagedContentImage, prepareContentDeliveryPack, type ContentStagingDeps, CONTENT_STAGING_MAX_BYTES } from "../lib/ops/content-media-staging";
import { contentPreviewHashes } from "../lib/ops/content-preview-assets";
import type { OpsArtifact } from "../lib/ops/action-types";
const origin = "https://marc-watters-site-16pby9lsy-kevinflowstate-7682s-projects.vercel.app";
function harness() {
  const payload = {
    schema_version: 1, pack_id: "real-carousel", version: 1, timezone: "Europe/London", location_id: "93GJEdsr0cT9el3OINXq",
    source: { provider: "upload", id: "private-upload", revision: "one" },
    posts: [{ post_id: "instagram-1", platform: "instagram", account_id: "marc-social", caption: "Exact caption", schedule_at: "2026-11-12T10:00:00Z",
      media: contentPreviewHashes.map((sha256, i) => ({ asset_id: `slide-${i+1}`, sha256, mime_type: "image/png", url: `${origin}/ops-drafts/cbb-busy-profitable-v2/${sha256}.png` })) }],
  };
  const core = { kind: "content", action: "schedule_content", title: "Existing carousel", payload, destination: { location_id: payload.location_id }, item_keys: ["instagram-1"] };
  const artifact = { ...core, id: "00000000-0000-4000-8000-000000000001", external_ref: "existing-carousel", version: 1, status: "draft", manifest_hash: artifactHash(core), execution_started_at: null } as unknown as OpsArtifact;
  const objects = new Map<string, Uint8Array>();
  const deps: ContentStagingDeps = {
    artifact: vi.fn(async () => structuredClone(artifact)), privateBucket: vi.fn(async () => {}),
    read: vi.fn(async (path) => objects.get(path) ?? null),
    writeOnce: vi.fn(async (path, bytes) => { if (!objects.has(path)) objects.set(path, bytes); }),
  };
  const snapshot = { version: 1, manifest_hash: artifact.manifest_hash };
  const bytes = (i=0) => readFileSync(`public/ops-drafts/cbb-busy-profitable-v2/${contentPreviewHashes[i]}.png`);
  const upload = (b=bytes()) => new Request("https://preview.example/upload", { method: "POST", headers: { "content-type": "image/png" }, body: b });
  return { artifact, objects, deps, snapshot, bytes, upload };
}
describe("private content staging", () => {
  it("stores and reads actual five-slide bytes in order without changing the artifact or approval", async () => {
    const h = harness(), original = structuredClone(h.artifact);
    for (let i=0; i<5; i++) {
      const receipt = await stageContentImage(h.artifact.id, h.snapshot, `slide-${i+1}`, h.upload(h.bytes(i)), h.deps);
      expect(receipt).toMatchObject({ private: true, public_copy_created: false, approval_changed: false, sha256: contentPreviewHashes[i] });
      const read = await readStagedContentImage(h.artifact.id, h.snapshot, `slide-${i+1}`, h.deps);
      expect(createHash("sha256").update(read.bytes).digest("hex")).toBe(contentPreviewHashes[i]);
    }
    expect(h.artifact).toEqual(original);
    const planned = await prepareContentDeliveryPack(h.artifact.id, h.snapshot, "https://media.example.com", h.deps);
    expect(planned.requires_new_approval).toBe(true);
    expect(planned.public_copy_created).toBe(false);
    expect(planned.proposed_pack.version).toBe(2);
    expect(planned.proposed_pack.posts[0].media.map(m => m.sha256)).toEqual([...contentPreviewHashes]);
    expect(planned.proposed_pack.posts[0].caption).toBe("Exact caption");
    expect(planned.proposed_pack.posts[0].account_id).toBe("marc-social");
    expect(planned.proposed_pack.posts[0].media[0].url).toBe(`https://media.example.com/cbb-content/${contentPreviewHashes[0]}.png`);
    expect(artifactHash({ ...original, payload: planned.proposed_pack })).not.toBe(original.manifest_hash);
    expect(h.objects.size).toBe(5);
  });
  it("reuses an identical upload without overwriting and fails closed on corrupted storage", async () => {
    const h = harness();
    await stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(), h.deps);
    await stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(), h.deps);
    expect(h.deps.writeOnce).toHaveBeenCalledTimes(1);
    h.objects.set([...h.objects.keys()][0], new Uint8Array([1,2,3]));
    await expect(readStagedContentImage(h.artifact.id, h.snapshot, "slide-1", h.deps)).rejects.toThrow("do not match");
  });
  it("rejects changed bytes, oversized inputs, unknown assets and stale approvals before writing", async () => {
    const h = harness();
    await expect(stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(h.bytes(1)), h.deps)).rejects.toThrow("do not match");
    await expect(stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(Buffer.alloc(CONTENT_STAGING_MAX_BYTES+1)), h.deps)).rejects.toThrow("3 MiB");
    await expect(stageContentImage(h.artifact.id, h.snapshot, "missing", h.upload(), h.deps)).rejects.toThrow("not in");
    await expect(stageContentImage(h.artifact.id, { ...h.snapshot, version: 2 }, "slide-1", h.upload(), h.deps)).rejects.toThrow("Artifact changed");
    expect(h.deps.writeOnce).not.toHaveBeenCalled();
  });
  it("rejects missing/public storage, changed versions during upload, and work already executing", async () => {
    const h = harness();
    vi.mocked(h.deps.privateBucket).mockRejectedValueOnce(Error("Private storage missing"));
    await expect(stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(), h.deps)).rejects.toThrow("Private storage missing");
    expect(h.deps.writeOnce).not.toHaveBeenCalled();
    vi.mocked(h.deps.artifact).mockResolvedValueOnce(h.artifact).mockResolvedValueOnce({ ...h.artifact, status: "superseded" });
    await expect(stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(), h.deps)).rejects.toThrow("current");
    vi.mocked(h.deps.artifact).mockResolvedValue({ ...h.artifact, status: "running" });
    await expect(stageContentImage(h.artifact.id, h.snapshot, "slide-1", h.upload(), h.deps)).rejects.toThrow("execution has already started");
  });
  it("requires every image before preparing new delivery and refuses share/signed hosts", async () => {
    const h = harness();
    await expect(prepareContentDeliveryPack(h.artifact.id, h.snapshot, "https://media.example.com", h.deps)).rejects.toThrow("Stage every");
    for (const url of ["http://media.example.com", "https://name:password@media.example.com", "https://media.example.com/?token=secret", "https://media.example.com/path"]) {
      await expect(prepareContentDeliveryPack(h.artifact.id, h.snapshot, url, h.deps)).rejects.toThrow("HTTPS media origin");
    }
    expect(h.deps.writeOnce).not.toHaveBeenCalled();
  });
});
