import { z } from "zod";
import { adminActor } from "@/lib/ops/http";
import { OpsError, uuid } from "@/lib/ops/tasks";
import { createAdminClient } from "@/lib/supabase/admin";
import { contentResponse } from "@/lib/content/http";
import { loadVideo, reconcileVideo } from "@/lib/content/schedule";
import { syncReviewTask } from "@/lib/content/review-task";
import { platforms } from "@/lib/content/types";
const edit = z
  .object({
    revision: z.string().datetime({ offset: true }),
    action: z.enum(["save", "skip", "reconcile"]),
    caption: z.string().max(20000).optional(),
    suggested_at: z.string().datetime({ offset: true }).optional(),
    platforms: z.array(z.enum(platforms)).min(1).max(3).optional(),
  })
  .strict();
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return contentResponse(async () => {
    await adminActor();
    const id = uuid((await params).id);
    const parsed = edit.safeParse(await request.json());
    if (!parsed.success)
      throw new OpsError("Check the caption, date and platforms", 400);
    const body = parsed.data;
    if (body.action === "reconcile") return reconcileVideo(id);
    const v = await loadVideo(id);
    if (v.approved_at || v.status === "importing" || v.status === "skipped")
      throw new OpsError(
        "This video is locked. Edit scheduled posts in the CRM.",
        409,
      );
    const data =
      body.action === "skip"
        ? { status: "skipped" }
        : {
            ...(body.caption !== undefined
              ? { caption: body.caption, caption_source: "manual" }
              : {}),
            ...(body.suggested_at ? { suggested_at: body.suggested_at } : {}),
            ...(body.platforms
              ? { platforms: [...new Set(body.platforms)] }
              : {}),
          };
    const r = await createAdminClient()
      .from("content_videos")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", body.revision)
      .is("approved_at", null)
      .select("id")
      .maybeSingle();
    if (r.error || !r.data)
      throw new OpsError(
        "Video changed or that day is already claimed. Refresh and choose another date.",
        409,
      );
    if (body.action === "skip") await syncReviewTask();
    return loadVideo(id);
  });
}
