import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import {
  CBB_LOCATION_ID,
  ContentPackError,
  validateContentPack,
} from "../lib/ops/content-pack";
import type { OpsArtifact, ArtifactItem } from "../lib/ops/action-types";
import type { ArtifactExecutionDeps } from "../lib/ops/artifact-execution";

const nativeRequire = createRequire(import.meta.url);
class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const taskHelpers = {
  OpsError,
  record: (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new OpsError("Object required");
    return v;
  },
};
function load<T>(file: string, deps: Record<string, unknown>): T {
  const code = transformSync(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const m = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name: string) => {
      if (name in deps) return deps[name];
      if (name === "./tasks") return taskHelpers;
      if (name.startsWith("node:")) return nativeRequire(name);
      throw Error("Unexpected dependency: " + name);
    },
    m,
    m.exports,
  );
  return m.exports as T;
}
const validation = load<typeof import("../lib/ops/action-validation")>(
  "../lib/ops/action-validation.ts",
  {},
);
const lessonManifest = (input: unknown) => {
  const v = input as {
    schema_version: number;
    version: number;
    module_id: string;
    media: { verification_id: string };
  };
  if (v.schema_version !== 1) throw new OpsError("Invalid lesson");
  return v;
};
const api = load<typeof import("../lib/ops/artifact-execution")>(
  "../lib/ops/artifact-execution.ts",
  {
    "@/lib/env": { getEnv: () => undefined },
    "./actions": {},
    "./action-validation": validation,
    "./content-pack": { ContentPackError, validateContentPack },
    "./content-scheduling": {},
    "./content-preflight": {},
    "./lesson-publication": {
      validateLessonPublicationManifest: lessonManifest,
    },
  },
);
const id = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222";
function artifact(
  kind: "content" | "lesson" = "content",
  count = 1,
): OpsArtifact {
  const post = {
    post_id: "post-1",
    platform: "instagram",
    account_id: "fixture-account",
    caption: "Approved exact caption",
    schedule_at: "2098-01-07T10:00:00Z",
    media: [
      {
        asset_id: "asset-1",
        sha256: "a".repeat(64),
        url: "https://assets.example.com/" + "a".repeat(64) + ".png",
        mime_type: "image/png",
      },
    ],
  };
  const payload =
    kind === "content"
      ? {
          schema_version: 1,
          pack_id: "pack-1",
          version: 1,
          timezone: "Europe/London",
          location_id: CBB_LOCATION_ID,
          source: { provider: "upload", id: "brief-1", revision: "v1" },
          posts: Array.from({ length: count }, (_, i) => ({
            ...post,
            post_id: `post-${i + 1}`,
          })),
        }
      : {
          schema_version: 1,
          lesson_ref: "lesson-1",
          version: 1,
          mode: "draft",
          module_id: "33333333-3333-4333-8333-333333333333",
          title: "Lesson",
          summary_md: "Summary",
          workbook_md: "Workbook",
          media: {
            verification_id: "44444444-4444-4444-8444-444444444444",
            storage_path: "approved/video.mp4",
            sha256: "a".repeat(64),
          },
        };
  const value: OpsArtifact = {
    id,
    external_ref: "fixture:pack",
    version: 1,
    kind,
    action: kind === "content" ? "schedule_content" : "publish_lesson",
    title: "Prepared work",
    payload: JSON.parse(JSON.stringify(payload)),
    destination:
      kind === "content"
        ? { location_id: CBB_LOCATION_ID }
        : { module_id: "33333333-3333-4333-8333-333333333333" },
    item_keys:
      kind === "content"
        ? Array.from({ length: count }, (_, i) => `post-${i + 1}`)
        : ["lesson"],
    manifest_hash: "",
    status: "approved",
    submitted_by: "fixture",
    approved_by: actor,
    approved_at: "2026-11-05T10:00:00Z",
    claim_id: null,
    execution_started_at: null,
    finished_at: null,
    created_at: "2026-11-05T10:00:00Z",
    updated_at: "2026-11-05T10:00:00Z",
  };
  rehash(value);
  return value;
}
function rehash(v: OpsArtifact) {
  v.manifest_hash = validation.artifactHash({
    kind: v.kind,
    action: v.action,
    title: v.title,
    payload: v.payload,
    destination: v.destination,
    item_keys: v.item_keys,
  });
}
function harness(value = artifact()) {
  const current = structuredClone(value);
  const rows: ArtifactItem[] = current.item_keys.map((key, i) => ({
    id: `item-${i}`,
    artifact_id: id,
    item_key: key,
    status: "pending",
    receipt: null,
    error: null,
    started_at: null,
    finished_at: null,
    updated_at: "2026-11-05T10:00:00Z",
  }));
  const d = {
    get: vi.fn(async () => structuredClone(current)),
    items: vi.fn(async () => structuredClone(rows)),
    controls: vi.fn(() => ({
      content_scheduling: true,
      lesson_publication: true,
      payment_reminders: false,
    })),
    decide: vi.fn(
      async (_id: string, body: { decision: "approved" | "rejected" }) => {
        current.status = body.decision;
        return structuredClone(current);
      },
    ),
    claim: vi.fn(async () => {
      const reused = current.status !== "approved";
      if (!reused) {
        current.status = "running";
        current.claim_id = "claim-1";
      }
      return {
        artifact: structuredClone(current),
        claim_id: current.claim_id,
        reused,
      };
    }),
    claimItem: vi.fn(async (_id: string, _claim: string, key: string) => {
      const row = rows.find((r) => r.item_key === key)!;
      const claimed = row.status === "pending";
      if (claimed) row.status = "running";
      return { item: structuredClone(row), claimed };
    }),
    recordItem: vi.fn(
      async (
        _id: string,
        _claim: string,
        key: string,
        input: {
          status: ArtifactItem["status"];
          receipt: ArtifactItem["receipt"];
          error?: string | null;
        },
      ) => {
        const row = rows.find((r) => r.item_key === key)!;
        Object.assign(row, input);
        return structuredClone(row);
      },
    ),
    reconcile: vi.fn(async () => structuredClone(current)),
    finish: vi.fn(async () => {
      current.status = rows.every((r) => r.status === "succeeded")
        ? "completed"
        : "needs_attention";
      return structuredClone(current);
    }),
    contentExecute: vi.fn(async (_pack: unknown, key: string) => ({
      outcome: "scheduled",
      post_id: key,
      provider_id: "provider-" + key,
      receipt: { provider: "ghl", status: "scheduled" },
    })),
    lessonPreview: vi.fn(async () => ({
      dry_run: true,
      verification: { id: "verified-media" },
    })),
    lessonPublish: vi.fn(async () => {
      rows[0].status = "succeeded";
      rows[0].receipt = { content_id: "published-1" };
      return { content_id: "published-1" };
    }),
  };
  return {
    d,
    deps: d as unknown as ArtifactExecutionDeps,
    rows,
    current: () => current,
    snapshot: () => ({
      version: current.version,
      manifest_hash: current.manifest_hash,
    }),
  };
}

describe("domain-bound approvals", () => {
  it("binds read-only content checks to the exact saved version without claiming or approving", async () => {
    const h = harness();
    h.d.controls.mockReturnValue({
      content_scheduling: false,
      lesson_publication: false,
      payment_reminders: false,
    });
    const check = vi.fn(async () => ({
      dry_run: true,
      ready: false,
      checks: [],
      summary: "Scheduling is switched off.",
    }));
    await api.preflightPreparedContent(
      id,
      h.snapshot(),
      h.deps,
      check as unknown as Parameters<typeof api.preflightPreparedContent>[3],
    );
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      expect.any(Array),
      { enabled: false, postIds: undefined },
    );
    expect(h.d.claim).not.toHaveBeenCalled();
    expect(h.d.decide).not.toHaveBeenCalled();
    expect(h.d.contentExecute).not.toHaveBeenCalled();
    await expect(
      api.preflightPreparedContent(
        id,
        { ...h.snapshot(), version: 2 },
        h.deps,
        check as unknown as Parameters<typeof api.preflightPreparedContent>[3],
      ),
    ).rejects.toThrow();
    expect(check).toHaveBeenCalledOnce();
  });
  it("rejects content preflight setting injection and lesson actions before network checks", async () => {
    const h = harness();
    await expect(
      api.preflightPreparedContent(
        id,
        { ...h.snapshot(), enabled: true },
        h.deps,
      ),
    ).rejects.toThrow("Unsupported action field");
    const lesson = harness(artifact("lesson"));
    await expect(
      api.preflightPreparedContent(id, lesson.snapshot(), lesson.deps),
    ).rejects.toThrow("Choose a content pack");
  });
  it("does not return a ready result after approval or item progress changes during the checks", async () => {
    const h = harness();
    const check = vi.fn(async () => {
      h.current().status = "rejected";
      return { dry_run: true, ready: true, checks: [], summary: "Ready" };
    });
    await expect(
      api.preflightPreparedContent(
        id,
        h.snapshot(),
        h.deps,
        check as unknown as Parameters<typeof api.preflightPreparedContent>[3],
      ),
    ).rejects.toThrow("changed while the checks");
    expect(h.d.contentExecute).not.toHaveBeenCalled();
  });
  it("binds explicit recovery to current artifact/item and the authenticated actor", async () => {
    const h = harness();
    const recovery = {
      expected_updated_at: "2026-11-05T10:00:00Z",
      resolution: "retryable_failure",
      note: "Verified no post exists",
      executor_stopped: true,
    };
    await expect(
      api.reconcilePreparedArtifact(
        id,
        "other-item",
        { ...h.snapshot(), ...recovery },
        actor,
        h.deps,
      ),
    ).rejects.toThrow("Item is not part");
    expect(h.d.reconcile).not.toHaveBeenCalled();
    await api.reconcilePreparedArtifact(
      id,
      "post-1",
      { ...h.snapshot(), ...recovery },
      actor,
      h.deps,
    );
    expect(h.d.reconcile).toHaveBeenCalledWith(id, "post-1", recovery, actor);
  });
  it("rejects stale decisions and injected actor/options without saving a decision", async () => {
    const h = harness();
    await expect(
      api.decidePreparedArtifact(
        id,
        {
          ...h.snapshot(),
          manifest_hash: "b".repeat(64),
          decision: "approved",
        },
        actor,
        h.deps,
      ),
    ).rejects.toThrow("changed");
    await expect(
      api.decidePreparedArtifact(
        id,
        { ...h.snapshot(), decision: "approved", actor: "forged" },
        actor,
        h.deps,
      ),
    ).rejects.toThrow("Unsupported");
    expect(h.d.decide).not.toHaveBeenCalled();
  });
  it("rejects a validly hashed but mismatched domain destination, version or item list", () => {
    for (const change of [
      (v: OpsArtifact) => {
        v.destination = { location_id: "other" };
      },
      (v: OpsArtifact) => {
        v.version = 2;
      },
      (v: OpsArtifact) => {
        v.item_keys = ["different-post"];
      },
    ]) {
      const value = artifact();
      change(value);
      rehash(value);
      expect(() => api.validateArtifactDomain(value)).toThrow("does not match");
    }
    const changed = artifact();
    changed.title = "tampered";
    expect(() => api.validateArtifactDomain(changed)).toThrow("integrity");
  });
  it("checks actual lesson media before approval and supplies only the authenticated actor", async () => {
    const h = harness(artifact("lesson"));
    h.d.lessonPreview.mockRejectedValueOnce(new OpsError("Video changed", 409));
    await expect(
      api.decidePreparedArtifact(
        id,
        { ...h.snapshot(), decision: "approved" },
        actor,
        h.deps,
      ),
    ).rejects.toThrow("Video changed");
    expect(h.d.decide).not.toHaveBeenCalled();
    await api.decidePreparedArtifact(
      id,
      { ...h.snapshot(), decision: "approved" },
      actor,
      h.deps,
    );
    expect(h.d.decide).toHaveBeenCalledWith(
      id,
      { ...h.snapshot(), decision: "approved" },
      actor,
    );
  });
  it("keeps completed lesson history readable when its destination is already published", async () => {
    const value = artifact("lesson");
    value.status = "completed";
    const h = harness(value);
    h.d.lessonPreview.mockRejectedValueOnce(
      new OpsError("Destination already published", 409),
    );
    const detail = await api.getArtifactDetail(id, h.deps);
    expect(detail.artifact.status).toBe("completed");
    expect(detail.preview).toMatchObject({
      kind: "lesson",
      validation_error: "Destination already published",
      media_url: expect.stringContaining("/preview"),
    });
  });
});

describe("persistent action execution", () => {
  it("checks disabled gates and exact snapshots before claiming work", async () => {
    const h = harness();
    h.d.controls.mockReturnValue({
      content_scheduling: false,
      lesson_publication: false,
      payment_reminders: false,
    });
    await expect(
      api.executePreparedArtifact(id, h.snapshot(), actor, h.deps),
    ).rejects.toThrow("not enabled");
    await expect(
      api.executePreparedArtifact(
        id,
        { ...h.snapshot(), dry_run: false },
        actor,
        h.deps,
      ),
    ).rejects.toThrow("Unsupported");
    expect(h.d.claim).not.toHaveBeenCalled();
    expect(h.d.contentExecute).not.toHaveBeenCalled();
  });
  it("never treats a preview response as a successful real execution", async () => {
    const h = harness();
    h.d.contentExecute.mockResolvedValueOnce({
      outcome: "dry_run",
      post_id: "post-1",
    } as never);
    const result = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(result.artifact.status).toBe("needs_attention");
    expect(result.items[0].status).toBe("failed");
    expect(result.items[0].error).toContain("Preview only");
  });
  it("processes one post per request and safely continues without recreating successes", async () => {
    const h = harness(artifact("content", 2));
    const first = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(first.continuation_required).toBe(true);
    expect(first.artifact.status).toBe("running");
    expect(h.d.finish).not.toHaveBeenCalled();
    const second = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(second.artifact.status).toBe("completed");
    const third = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(third.reused).toBe(true);
    expect(h.d.contentExecute.mock.calls.map((c) => c[1])).toEqual([
      "post-1",
      "post-2",
    ]);
  });
  it("does not duplicate an item when two requests overlap", async () => {
    const h = harness();
    let release: () => void = () => undefined;
    h.d.contentExecute.mockImplementationOnce(async (_p, key) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        outcome: "scheduled",
        post_id: key,
        provider_id: "provider-1",
        receipt: { provider: "ghl", status: "scheduled" },
      };
    });
    const first = api.executePreparedArtifact(id, h.snapshot(), actor, h.deps);
    await vi.waitFor(() => expect(h.d.contentExecute).toHaveBeenCalledOnce());
    const second = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(second.in_progress).toBe(true);
    expect(h.d.contentExecute).toHaveBeenCalledOnce();
    release();
    await first;
  });
  it("holds an ambiguous timeout for reconciliation, while another approved post can still finish", async () => {
    const h = harness(artifact("content", 2));
    h.d.contentExecute.mockRejectedValueOnce(
      new Error("Timeout with a secret upstream detail"),
    );
    const first = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(first.items[0].status).toBe("unknown");
    expect(first.items[0].error).not.toContain("secret");
    expect(first.continuation_required).toBe(true);
    const second = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(second.artifact.status).toBe("needs_attention");
    expect(second.items.map((i) => i.status)).toEqual(["unknown", "succeeded"]);
    expect(h.d.contentExecute).toHaveBeenCalledTimes(2);
  });
  it("requires a provider ID plus receipt and preserves a running claim if saving fails", async () => {
    const h = harness();
    h.d.contentExecute.mockResolvedValueOnce({
      outcome: "scheduled",
      post_id: "post-1",
    } as never);
    expect(
      (await api.executePreparedArtifact(id, h.snapshot(), actor, h.deps))
        .items[0].status,
    ).toBe("unknown");
    const q = harness();
    q.d.recordItem.mockRejectedValueOnce(new Error("DB outcome unknown"));
    await expect(
      api.executePreparedArtifact(id, q.snapshot(), actor, q.deps),
    ).rejects.toThrow();
    expect(q.rows[0].status).toBe("running");
    expect(q.d.contentExecute).toHaveBeenCalledOnce();
  });
  it("uses the atomic lesson item receipt and handles a lost RPC response by readback", async () => {
    const h = harness(artifact("lesson"));
    h.d.lessonPublish.mockImplementationOnce(async () => {
      h.rows[0].status = "succeeded";
      h.rows[0].receipt = { content_id: "saved" };
      throw Error("Lost response after commit");
    });
    const result = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(result.artifact.status).toBe("completed");
    expect(h.d.recordItem).not.toHaveBeenCalled();
  });
  it("does not let an expired already-successful post block valid pending content", async () => {
    const value = artifact("content", 2);
    (value.payload.posts as Array<Record<string, unknown>>)[0].schedule_at =
      "2020-01-01T10:00:00Z";
    rehash(value);
    const h = harness(value);
    h.rows[0].status = "succeeded";
    h.rows[0].receipt = { provider_id: "old" };
    h.current().status = "running";
    h.current().claim_id = "claim-1";
    const detail = await api.getArtifactDetail(id, h.deps);
    expect(detail.preview).not.toHaveProperty("validation_error");
    const result = await api.executePreparedArtifact(
      id,
      h.snapshot(),
      actor,
      h.deps,
    );
    expect(result.artifact.status).toBe("completed");
    expect(h.d.contentExecute).toHaveBeenCalledOnce();
    expect(h.d.contentExecute.mock.calls[0][1]).toBe("post-2");
  });
});
