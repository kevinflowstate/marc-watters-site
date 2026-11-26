import { Sandbox } from "@vercel/sandbox";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EditPlan } from "./lesson-edit-plan";

export async function launchLessonRender(
  name: string, plan: EditPlan, video: { url: string; bytes: number }, upload: string, receiptUrl: string,
) {
  const box = await Sandbox.create({
    name, persistent: false, timeout: 50 * 60_000, resources: { vcpus: 4 },
    source: { type: "snapshot", snapshotId: process.env.OPS_LESSON_RENDER_SNAPSHOT || "snap_K8lCd4EiHNRqihWBMEj0QldBRWpd" },
    networkPolicy: { allow: [...new Set([video.url, upload, receiptUrl].map(value => new URL(value).hostname))] },
  });
  try {
    const files = await Promise.all(["worker.py", "render_lesson.py"].map(async path => ({
      path, content: await readFile(join(process.cwd(), "scripts/lesson-render", path)),
    })));
    await box.writeFiles([...files, { path: "job.json", content: Buffer.from(JSON.stringify({
      recording_id: plan.recording_id, keep_ranges: plan.keep_ranges, transcript_end_s: plan.transcript_end_s,
      video: video.url, bytes: video.bytes, upload, receipt_url: receiptUrl,
    })) }]);
    await box.runCommand({ cmd: "python3", args: ["worker.py"], detached: true });
  } catch (error) {
    await box.stop().catch(() => undefined);
    throw error;
  }
}

export async function stopLessonRender(name: string) {
  const box = await Sandbox.get({ name, resume: false });
  if (box.status === "running") await box.stop();
}
