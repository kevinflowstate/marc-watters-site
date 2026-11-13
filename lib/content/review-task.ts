import { createAdminClient } from "@/lib/supabase/admin";
import { createTask, updateTask, OpsError } from "@/lib/ops/tasks";
/** One standing Eimear task, reopened only when a new review queue arrives. */
export async function syncReviewTask() {
  const db = createAdminClient();
  const rows = await db
    .from("content_videos")
    .select("id", { count: "exact", head: true })
    .is("approved_at", null)
    .neq("status", "skipped");
  if (rows.error)
    throw new OpsError("Review task count could not be read", 502);
  const count = rows.count ?? 0;
  if (count) {
    const task = await createTask(
      {
        kind: "task",
        title: `${count} new videos to review`,
        area: "content",
        assignee: "eimear",
        source: "system",
        external_ref: "content-videos:review",
        detail:
          "Check each video, caption and London posting date, then approve the selected platforms.",
        links: [{ label: "Review videos", url: "/admin/content" }],
      },
      "system:content-intake",
    );
    if (["done", "cancelled"].includes(task.status))
      await updateTask(task.id, { status: "open" }, "system:content-intake");
  } else {
    const task = await db
      .from("ops_tasks")
      .select("id,status")
      .eq("external_ref", "content-videos:review")
      .maybeSingle();
    if (task.error) throw new OpsError("Review task could not be read", 502);
    if (task.data && !["done", "cancelled"].includes(task.data.status))
      await updateTask(
        task.data.id,
        { status: "done" },
        "system:content-intake",
      );
  }
}
