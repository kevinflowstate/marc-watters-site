import type { Video } from "@/lib/content/types";
/** Read-only sample objects, never seeded into any database. Server only, preview only. */
export function sampleVideos(): Video[] {
  return [
    "01 — Know your numbers.mp4",
    "02 — Price for profit.mp4",
    "03 — Build a business that runs without you.mp4",
    "04 — Stop chasing turnover.mp4",
  ].map((file_name, i) => ({
    id: `sample-${i}`,
    drive_file_id: "",
    drive_md5: null,
    file_name,
    mime_type: "video/mp4",
    size_bytes: 42000000,
    status: "ready",
    failure_reason: null,
    media_url:
      "/media/webinar/marc-webinar-thank-you-vsl.mp4",
    media_file_id: null,
    caption:
      i === 3
        ? ""
        : "𝗞𝗻𝗼𝘄 𝘆𝗼𝘂𝗿 𝗻𝘂𝗺𝗯𝗲𝗿𝘀.\n\nBeing busy does not mean your business is making money.\n\nStart with the true cost of the job. Know your margin before you send the quote. Then review it when the job is finished.\n\nWhat is one number you need to get clear on this week?",
    caption_source: "sidecar",
    suggested_at: `2026-11-${14 + i}T18:00:00.000Z`,
    schedule_at: null,
    platforms: ["instagram", "facebook", "linkedin"],
    approved_by: null,
    approved_at: null,
    created_at: "2026-11-10T10:30:00Z",
    updated_at: "2026-11-10T10:30:00Z",
    content_video_posts: [],
  }));
}
