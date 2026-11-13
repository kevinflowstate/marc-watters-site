import { describe, expect, it, vi } from "vitest";
import { sampleVideos } from "@/app/admin/content/sample";
import type { Video } from "@/lib/content/types";
import {
  editReview,
  newReview,
  reviewIssue,
  scheduleReviews,
  type Review,
} from "@/lib/content/review";

function item(id = "video-1") {
  const video = {
    ...sampleVideos()[0],
    id,
    suggested_at: "2099-11-14T18:00:00.000Z",
  };
  return { video, review: { ...newReview(video), approved: true } };
}
function operations() {
  return {
    enabled: true,
    sample: false,
    save: vi.fn<(v: Video, r: Review) => Promise<Video>>(async (v) => ({
      ...v,
      updated_at: "2026-11-13T12:00:00Z",
    })),
    schedule: vi.fn<(v: Video) => Promise<Video>>(async (v) => ({
      ...v,
      status: "scheduled" as const,
    })),
    onResult: vi.fn(),
  };
}
describe("content review before batch scheduling", () => {
  it.each([
    { caption: "Updated copy" },
    { date: "2099-11-16T18:00" },
    { platforms: ["linkedin" as const] },
  ])("clears approval when reviewed fields change: %j", (patch) => {
    const { review } = item();
    expect(editReview(review, patch).approved).toBe(false);
    expect(review.approved).toBe(true);
  });
  it("rejects missing captions, invalid dates, missing platforms and over-limit copy", () => {
    const { video, review } = item();
    for (const patch of [
      { caption: " " },
      { date: "" },
      { date: "2020-01-01T18:00" },
      { date: "2099-02-31T18:00" },
      { platforms: [] },
      { caption: "x".repeat(2201) },
    ]) {
      expect(reviewIssue(video, { ...review, ...patch })).toBeTruthy();
    }
  });
  it("requires re-review of replaced/stale files and blocks existing receipts", () => {
    const { video, review } = item();
    expect(reviewIssue({ ...video, updated_at: "changed" }, review)).toMatch(
      /changed/,
    );
    expect(reviewIssue({ ...video, status: "replaced" }, review)).toMatch(
      /importing/,
    );
    expect(
      reviewIssue({ ...video, approved_at: "2026-11-13T10:00:00Z" }, review),
    ).toMatch(/receipts/);
  });
  it.each([
    { enabled: false, sample: false },
    { enabled: true, sample: true },
  ])("makes no calls when scheduling is blocked: %j", async (flags) => {
    const io = { ...operations(), ...flags };
    await expect(scheduleReviews([item()], io)).rejects.toThrow(/switched off/);
    expect(io.save).not.toHaveBeenCalled();
    expect(io.schedule).not.toHaveBeenCalled();
  });
  it("validates the entire selection before saving or scheduling anything", async () => {
    const io = operations(),
      invalid = item("invalid");
    invalid.review.approved = false;
    await expect(scheduleReviews([item(), invalid], io)).rejects.toThrow(
      /approve/,
    );
    expect(io.save).not.toHaveBeenCalled();
    await expect(scheduleReviews([item(), item()], io)).rejects.toThrow(
      /more than once/,
    );
    expect(io.schedule).not.toHaveBeenCalled();
  });
  it("passes the saved revision to each guarded create, preserves partial results and never retries uncertain calls", async () => {
    const io = operations();
    io.schedule
      .mockResolvedValueOnce({ ...item().video, status: "partly_scheduled" })
      .mockRejectedValueOnce(new Error("Request timed out; check receipts"))
      .mockResolvedValueOnce({ ...item("video-3").video, status: "scheduled" });
    const results = await scheduleReviews(
      [item(), item("video-2"), item("video-3")],
      io,
    );
    expect(io.save).toHaveBeenCalledTimes(3);
    expect(io.schedule).toHaveBeenCalledTimes(3);
    expect(io.schedule.mock.calls.map(([v]) => v.updated_at)).toEqual(
      Array(3).fill("2026-11-13T12:00:00Z"),
    );
    expect(results.map((r) => r.video?.status ?? r.error)).toEqual([
      "partly_scheduled",
      "Request timed out; check receipts",
      "scheduled",
    ]);
    expect(io.onResult).toHaveBeenCalledTimes(3);
  });
  it("never calls create when saving fails, but can finish other approved videos", async () => {
    const io = operations();
    io.save.mockRejectedValueOnce(new Error("Video changed"));
    const results = await scheduleReviews([item(), item("video-2")], io);
    expect(io.schedule).toHaveBeenCalledTimes(1);
    expect(results[0].error).toBe("Video changed");
    expect(results[1].video?.status).toBe("scheduled");
  });
});
