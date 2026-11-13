import { afterEach, describe, expect, it, vi } from "vitest";
import type { Video, VideoPost } from "../lib/content/types";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  accounts: vi.fn(),
  list: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("../lib/supabase/admin", () => ({ createAdminClient: mocks.db }));
vi.mock("../lib/content/review-task", () => ({ syncReviewTask: mocks.sync }));
vi.mock("../lib/content/crm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/content/crm")>()),
  accounts: mocks.accounts,
  listPosts: mocks.list,
}));
import {
  approveVideo,
  reconcileVideo,
  videoPayload,
} from "../lib/content/schedule";
import { CBB_LOCATION_ID } from "../lib/ops/content-pack";
const initial: Video = {
  id: "v",
  drive_file_id: "drive",
  drive_md5: "hash",
  file_name: "video.mp4",
  mime_type: "video/mp4",
  size_bytes: 123,
  status: "ready",
  failure_reason: null,
  media_url: "https://files.leadconnectorhq.com/v.mp4",
  media_file_id: "media",
  caption: "Caption",
  caption_source: "manual",
  suggested_at: "2099-11-13T18:00:00Z",
  schedule_at: null,
  platforms: ["instagram", "facebook", "linkedin"],
  approved_by: null,
  approved_at: null,
  created_at: "2026-11-13T09:00:00Z",
  updated_at: "2026-11-13T09:00:00Z",
  content_video_posts: [],
};
function setup() {
  const video = structuredClone(initial);
  let claims = 0;
  const db = {
    from: (table: string) => {
      let patch: Record<string, unknown> | undefined;
      const conditions: Record<string, unknown> = {};
      const q = {
        select: () => q,
        update: (p: Record<string, unknown>) => {
          patch = p;
          return q;
        },
        eq: (k: string, v: unknown) => {
          conditions[k] = v;
          return q;
        },
        single: async () => ({ data: structuredClone(video), error: null }),
        then: (resolve: (v: unknown) => void) => {
          if (patch) {
            if (table === "content_videos") Object.assign(video, patch);
            else {
              const row = video.content_video_posts.find(
                (p) =>
                  p.id === conditions.id &&
                  (!conditions.outcome || p.outcome === conditions.outcome),
              );
              if (row) Object.assign(row, patch);
            }
          }
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    },
    rpc: vi.fn(
      async (_name: string, args: { p_revision: string; p_retry?: string }) => {
        claims++;
        if (video.updated_at !== args.p_revision)
          return { error: { message: "stale" } };
        video.approved_at = "2026-11-13T10:00:00Z";
        video.schedule_at = video.suggested_at;
        video.updated_at = "2026-11-13T10:00:00Z";
        const rows: VideoPost[] = [];
        for (const p of video.platforms) {
          const old = video.content_video_posts.find((x) => x.platform === p);
          if (args.p_retry) {
            if (p === args.p_retry && old?.outcome === "failed") {
              old.outcome = "claimed";
              rows.push(old);
            }
          } else if (!old) {
            const row: VideoPost = {
              id: p,
              video_id: "v",
              platform: p,
              account_id: p,
              outcome: "claimed",
              provider_post_id: null,
              receipt: null,
              reason: null,
              created_at: "2026-11-13T10:00:00Z",
            };
            video.content_video_posts.push(row);
            rows.push(row);
          }
        }
        return { data: structuredClone(rows), error: null };
      },
    ),
  };
  mocks.db.mockReturnValue(db);
  mocks.accounts.mockResolvedValue(
    video.platforms.map((p) => ({
      id: p,
      platform: p,
      locationId: CBB_LOCATION_ID,
      active: true,
      isExpired: false,
    })),
  );
  mocks.list.mockResolvedValue([]);
  mocks.sync.mockResolvedValue(undefined);
  vi.stubEnv("OPS_CONTENT_SCHEDULING_ENABLED", "true");
  vi.stubEnv("CBB_GHL_PIT_TOKEN", "token");
  vi.stubEnv("CBB_GHL_USER_ID", "user");
  return { video, db, claims: () => claims };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("persisted platform claims", () => {
  it("preserves two successes and retries only the failed platform", async () => {
    const { video } = setup();
    let fail = true;
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          const platform = body.accountIds[0];
          calls.push(platform);
          if (platform === "facebook" && fail)
            return new Response("{}", { status: 400 });
          return Response.json({ results: { post: { _id: platform } } });
        }
        const p = url.split("/").pop()! as
          "instagram" | "facebook" | "linkedin";
        return Response.json({
          results: {
            post: {
              ...videoPayload(video, p, p, "user"),
              _id: p,
              locationId: CBB_LOCATION_ID,
            },
          },
        });
      }),
    );
    await approveVideo("v", "admin", video.updated_at);
    expect(video.status).toBe("partly_scheduled");
    expect(video.content_video_posts.map((p) => p.outcome)).toEqual([
      "scheduled",
      "failed",
      "scheduled",
    ]);
    fail = false;
    await approveVideo("v", "admin", video.updated_at, "facebook");
    expect(calls).toEqual(["instagram", "facebook", "linkedin", "facebook"]);
    expect(video.status).toBe("scheduled");
  });
  it("rejects stale double clicks before a claim or create", async () => {
    const { video, claims } = setup();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    video.updated_at = "2026-11-13T10:00:00Z";
    await expect(
      approveVideo("v", "admin", initial.updated_at),
    ).rejects.toThrow("changed");
    expect(claims()).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
  it("blocks all approval work when disabled", async () => {
    setup();
    vi.stubEnv("OPS_CONTENT_SCHEDULING_ENABLED", " false ");
    await expect(
      approveVideo("v", "admin", initial.updated_at),
    ).rejects.toThrow("switched off");
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("reconciles an uncertain create without creating another post", async () => {
    const { video } = setup();
    video.approved_at = "2026-11-13T10:00:00Z";
    video.schedule_at = video.suggested_at;
    video.content_video_posts = [
      {
        id: "instagram",
        video_id: "v",
        platform: "instagram",
        account_id: "instagram",
        outcome: "uncertain",
        provider_post_id: null,
        receipt: null,
        reason: "timeout",
        created_at: "2026-11-13T10:00:00Z",
      },
    ];
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    mocks.list.mockResolvedValue([
      {
        ...videoPayload(video, "instagram", "instagram", "user"),
        _id: "found",
        locationId: CBB_LOCATION_ID,
      },
    ]);
    await reconcileVideo("v");
    expect(video.content_video_posts[0].outcome).toBe("scheduled");
    expect(video.content_video_posts[0].provider_post_id).toBe("found");
    expect(f).not.toHaveBeenCalled();
  });
  it("an empty reconciliation result never unlocks a retry", async () => {
    const { video } = setup();
    video.schedule_at = video.suggested_at;
    video.content_video_posts = [
      {
        id: "instagram",
        video_id: "v",
        platform: "instagram",
        account_id: "instagram",
        outcome: "uncertain",
        provider_post_id: null,
        receipt: null,
        reason: "timeout",
        created_at: "2026-11-13T10:00:00Z",
      },
    ];
    await reconcileVideo("v");
    expect(video.content_video_posts[0].outcome).toBe("uncertain");
  });
});
