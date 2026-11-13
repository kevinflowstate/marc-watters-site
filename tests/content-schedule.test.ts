import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aggregateStatus,
  executeVideoPost,
  matchesPost,
  videoPayload,
} from "../lib/content/schedule";
import { CBB_LOCATION_ID } from "../lib/ops/content-pack";
import type { VideoPost } from "../lib/content/types";
import { accountWarnings } from "../lib/content/crm";
import { importOneVideo } from "../lib/content/import";
const video = {
  caption: "A caption",
  media_url: "https://files.leadconnectorhq.com/video.mp4",
  mime_type: "video/mp4",
  suggested_at: "2026-12-01T18:00:00.000Z",
  schedule_at: null,
};
afterEach(() => vi.unstubAllEnvs());
function enabled() {
  vi.stubEnv("OPS_CONTENT_SCHEDULING_ENABLED", " true ");
  vi.stubEnv("CBB_GHL_PIT_TOKEN", " secret ");
}
const payload = videoPayload(video, "facebook", "fb", "user");
const saved = {
  ...payload,
  scheduleDate: video.suggested_at,
  _id: "receipt",
  locationId: CBB_LOCATION_ID,
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
describe("platform payload and guarded create", () => {
  it.each(["instagram", "facebook", "linkedin"] as const)(
    "builds one %s destination",
    (p) => {
      const body = videoPayload(video, p, "account", "user");
      expect(body.accountIds).toEqual(["account"]);
      expect(body.type).toBe(p === "linkedin" ? "post" : "reel");
      expect(body.media).toEqual([{ url: video.media_url, type: "video/mp4" }]);
      expect(body.status).toBe("scheduled");
      expect(body.scheduleDate).toBe(video.suggested_at);
      if (p === "instagram")
        expect(body.instagramPostDetails).toEqual({ type: "reel" });
      if (p === "facebook")
        expect(body.facebookPostDetails).toEqual({ type: "reel" });
    },
  );
  it("writes nothing with the switch off, including media import", async () => {
    vi.stubEnv("OPS_CONTENT_SCHEDULING_ENABLED", "false");
    const f = vi.fn();
    await expect(executeVideoPost(payload, f)).rejects.toThrow("switched off");
    expect(f).not.toHaveBeenCalled();
    expect(await importOneVideo()).toEqual({
      imported: false,
      reason: "Scheduling is switched off",
    });
  });
  it("requires strict readback and keeps a receipt", async () => {
    enabled();
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        response({ results: { post: { _id: "receipt" } } }),
      )
      .mockResolvedValueOnce(response({ results: { post: saved } }));
    const r = await executeVideoPost(payload, f);
    expect(r.outcome).toBe("scheduled");
    expect(r.receipt?.account_id).toBe("fb");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it.each([500, 502, 408, 409, 425, 429])(
    "never retries uncertain HTTP %s",
    async (status) => {
      enabled();
      const f = vi.fn().mockResolvedValue(response({}, status));
      expect((await executeVideoPost(payload, f)).outcome).toBe("uncertain");
      expect(f).toHaveBeenCalledTimes(1);
    },
  );
  it("a timeout stays uncertain", async () => {
    enabled();
    const f = vi.fn().mockRejectedValue(new Error("timeout"));
    expect((await executeVideoPost(payload, f)).outcome).toBe("uncertain");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("a 400 is a definite failure eligible for an explicit retry", async () => {
    enabled();
    expect(
      (
        await executeVideoPost(
          payload,
          vi.fn().mockResolvedValue(response({}, 400)),
        )
      ).outcome,
    ).toBe("failed");
  });
  it("mismatched readback stays uncertain with the known provider id", async () => {
    enabled();
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        response({ results: { post: { _id: "receipt" } } }),
      )
      .mockResolvedValueOnce(
        response({ results: { post: { ...saved, summary: "Wrong" } } }),
      );
    const r = await executeVideoPost(payload, f);
    expect(r.outcome).toBe("uncertain");
    expect(r.provider_post_id).toBe("receipt");
  });
  it("rejects wrong destination, time, media, type and status during reconciliation", () => {
    for (const diff of [
      { accountIds: ["other"] },
      { scheduleDate: "2026-12-02T18:00:00Z" },
      { media: [] },
      { type: "post" },
      { status: "draft" },
      { locationId: "other" },
    ])
      expect(matchesPost({ ...saved, ...diff }, payload)).toBe(false);
  });
  it("keeps partial success across platforms without failing the whole video", async () => {
    enabled();
    const outcomes: VideoPost["outcome"][] = [];
    for (const p of ["instagram", "facebook", "linkedin"] as const) {
      const body = videoPayload(video, p, p, "user");
      const f =
        p === "facebook"
          ? vi.fn().mockResolvedValue(response({}, 400))
          : vi
              .fn()
              .mockResolvedValueOnce(
                response({ results: { post: { _id: p } } }),
              )
              .mockResolvedValueOnce(
                response({
                  results: {
                    post: { ...body, _id: p, locationId: CBB_LOCATION_ID },
                  },
                }),
              );
      outcomes.push((await executeVideoPost(body, f)).outcome);
    }
    expect(outcomes).toEqual(["scheduled", "failed", "scheduled"]);
    expect(aggregateStatus(outcomes, 3)).toBe("partly_scheduled");
    expect(aggregateStatus(["scheduled", "scheduled", "scheduled"], 3)).toBe(
      "scheduled",
    );
  });
  it("recognises the real account expiry field", () =>
    expect(
      accountWarnings(
        [
          {
            id: "a",
            name: "A",
            platform: "instagram",
            locationId: CBB_LOCATION_ID,
            active: true,
            isExpired: false,
            expire: "2026-11-20Z",
          },
        ],
        new Date("2026-11-13Z"),
      ),
    ).toEqual(["instagram: account expires within 14 days"]));
});
