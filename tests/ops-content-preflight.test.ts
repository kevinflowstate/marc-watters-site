import { describe, expect, it, vi } from "vitest";
import type { ArtifactItem, OpsArtifact } from "../lib/ops/action-types";
import { contentArtifactReadiness } from "../lib/ops/content-preflight";
import { CBB_LOCATION_ID, ContentPackError } from "../lib/ops/content-pack";
import {
  contentPostPayload,
  type verifyContentPostDelivery,
} from "../lib/ops/content-scheduling";

const now = new Date("2030-01-06T09:00:00Z");
function fixture(count = 1) {
  const artifact: OpsArtifact = {
    id: "11111111-1111-4111-8111-111111111111",
    external_ref: "fixture:pack",
    version: 1,
    kind: "content",
    action: "schedule_content",
    title: "Prepared content",
    payload: {
      schema_version: 1,
      pack_id: "pack-1",
      version: 1,
      timezone: "Europe/London",
      location_id: CBB_LOCATION_ID,
      source: { provider: "upload", id: "brief-1", revision: "v1" },
      posts: Array.from({ length: count }, (_, index) => ({
        post_id: `post-${index + 1}`,
        platform: "instagram",
        account_id: "account-1",
        caption: "A prepared caption.",
        schedule_at: "2030-01-07T10:00:00Z",
        media: [
          {
            asset_id: "image-1",
            sha256: "a".repeat(64),
            url: `https://assets.example.com/${"a".repeat(64)}.png`,
            mime_type: "image/png",
          },
        ],
      })),
    },
    destination: { location_id: CBB_LOCATION_ID },
    item_keys: Array.from({ length: count }, (_, i) => `post-${i + 1}`),
    manifest_hash: "a".repeat(64),
    status: "draft",
    submitted_by: "fixture",
    approved_by: null,
    approved_at: null,
    claim_id: null,
    execution_started_at: null,
    finished_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const items: ArtifactItem[] = artifact.item_keys.map((key, index) => ({
    id: `item-${index}`,
    artifact_id: artifact.id,
    item_key: key,
    status: "pending",
    receipt: null,
    error: null,
    started_at: null,
    finished_at: null,
    updated_at: now.toISOString(),
  }));
  return { artifact, items };
}
function verifier() {
  return vi.fn(async () => ({
    account_name: "Marc’s Instagram",
    checked_at: now.toISOString(),
    media: [{ asset_id: "image-1", sha256: "a".repeat(64), byte_size: 1234 }],
    planned: {
      method: "POST" as const,
      path: "/social-media-posting/fixture/posts",
      body: contentPostPayload(
        {
          post_id: "post-1",
          platform: "instagram",
          account_id: "account-1",
          caption: "A prepared caption.",
          schedule_at: "2030-01-07T10:00:00Z",
          media: [],
        },
        "fixture-user-123",
      ),
    },
  }));
}
describe("read-only content readiness", () => {
  it("can verify delivery while unapproved and switched off without claiming it is ready", async () => {
    const f = fixture(),
      verify = verifier();
    const result = await contentArtifactReadiness(f.artifact, f.items, {
      verify,
      now,
      enabled: false,
    });
    expect(result).toMatchObject({
      dry_run: true,
      ready: false,
      scheduling_enabled: false,
      approval_saved: false,
    });
    expect(result.checks[0]).toMatchObject({
      connection_ready: true,
      status: "blocked",
      blockers: [
        "This version still needs approval.",
        "Scheduling is switched off.",
      ],
    });
    expect(result.checks[0].schedule_label).toContain("London time");
    expect(f.artifact.status).toBe("draft");
    expect(f.items[0].status).toBe("pending");
  });
  it("reports ready only after the exact version has approval and delivery checks pass", async () => {
    const f = fixture();
    f.artifact.status = "approved";
    f.artifact.approved_by = "person-1";
    f.artifact.approved_at = now.toISOString();
    const result = await contentArtifactReadiness(f.artifact, f.items, {
      verify: verifier(),
      now,
      enabled: true,
    });
    expect(result.ready).toBe(true);
    expect(result.summary).toContain("Nothing has been scheduled");
    expect(result.checks[0].status).toBe("ready");
  });
  it("does not treat a forged status with no approver as approval", async () => {
    const f = fixture();
    f.artifact.status = "approved";
    expect(
      (
        await contentArtifactReadiness(f.artifact, f.items, {
          verify: verifier(),
          now,
          enabled: true,
        })
      ).approval_saved,
    ).toBe(false);
  });
  it("preserves partial successes and holds uncertain/running/failed attempts without requests", async () => {
    const f = fixture(4),
      verify = verifier();
    f.items[0].status = "succeeded";
    f.items[0].receipt = { provider_id: "saved-post", status: "scheduled" };
    f.items[1].status = "unknown";
    f.items[2].status = "running";
    f.items[3].status = "failed";
    const result = await contentArtifactReadiness(f.artifact, f.items, {
      verify,
      now,
      enabled: false,
      postIds: f.artifact.item_keys,
    });
    expect(result.checks.map((c) => c.status)).toEqual([
      "already_scheduled",
      "needs_attention",
      "needs_attention",
      "needs_attention",
    ]);
    expect(verify).not.toHaveBeenCalled();
    expect(result.ready).toBe(false);
  });
  it("does not call delivery checked for rejected, replaced or missing saved progress", async () => {
    for (const status of ["rejected", "superseded", "completed"] as const) {
      const f = fixture(),
        verify = verifier();
      f.artifact.status = status;
      const r = await contentArtifactReadiness(f.artifact, f.items, {
        verify,
        now,
        enabled: false,
      });
      expect(r.checks[0].status).toBe("blocked");
      expect(verify).not.toHaveBeenCalled();
    }
    const f = fixture(),
      verify = verifier();
    expect(
      (
        await contentArtifactReadiness(f.artifact, [], {
          verify,
          now,
          enabled: false,
          postIds: ["post-1"],
        })
      ).checks[0].status,
    ).toBe("blocked");
    expect(verify).not.toHaveBeenCalled();
  });
  it("keeps changed media/account errors visible and does not mark connection ready", async () => {
    const f = fixture(),
      verify = verifier().mockRejectedValue(
        new ContentPackError("Media bytes no longer match the approved file"),
      );
    const result = await contentArtifactReadiness(f.artifact, f.items, {
      verify,
      now,
      enabled: false,
    });
    expect(result.checks[0]).toMatchObject({
      connection_ready: false,
      status: "blocked",
      summary: "Media bytes no longer match the approved file",
    });
  });
  it("bounds each read check and identifies posts still needing a check", async () => {
    const f = fixture(7),
      verify = verifier();
    const result = await contentArtifactReadiness(f.artifact, f.items, {
      verify,
      now,
      enabled: false,
    });
    expect(result.checks).toHaveLength(5);
    expect(result.remaining_post_ids).toEqual(["post-6", "post-7"]);
    expect(result.has_more).toBe(true);
    await expect(
      contentArtifactReadiness(f.artifact, f.items, {
        verify,
        now,
        postIds: f.artifact.item_keys,
      }),
    ).rejects.toThrow("up to five");
    await expect(
      contentArtifactReadiness(f.artifact, f.items, {
        verify,
        now,
        postIds: ["missing"],
      }),
    ).rejects.toThrow();
    await expect(
      contentArtifactReadiness(f.artifact, f.items, {
        verify,
        now,
        postIds: ["post-1", "post-1"],
      }),
    ).rejects.toThrow();
  });
  it.each(["init", "request"])(
    "rejects any provider write attempted through %s inside a readiness check",
    async (mode) => {
      const f = fixture(),
        request = vi.fn();
      const verify = vi.fn<typeof verifyContentPostDelivery>(
        async (_input, _id, options) => {
          if (mode === "init")
            await options!.fetch!(
              "https://services.leadconnectorhq.com/posts",
              { method: "POST" },
            );
          else
            await options!.fetch!(
              new Request("https://services.leadconnectorhq.com/posts", {
                method: "POST",
              }),
            );
          return verifier()();
        },
      );
      const result = await contentArtifactReadiness(f.artifact, f.items, {
        verify,
        fetch: request,
        now,
        enabled: false,
      });
      expect(result.checks[0].summary).toContain("cannot create or change");
      expect(request).not.toHaveBeenCalled();
    },
  );
});
