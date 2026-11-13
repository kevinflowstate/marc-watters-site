import { adminActor } from "@/lib/ops/http";
import { OpsError, uuid } from "@/lib/ops/tasks";
import { contentResponse } from "@/lib/content/http";
import { approveVideo } from "@/lib/content/schedule";
import { platforms, type Platform } from "@/lib/content/types";
export const maxDuration = 300;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return contentResponse(async () => {
    const actor = await adminActor();
    const body = await request.json();
    if (
      typeof body.revision !== "string" ||
      !Number.isFinite(Date.parse(body.revision)) ||
      (body.retry && !platforms.includes(body.retry as Platform))
    )
      throw new OpsError("Invalid approval", 400);
    return approveVideo(
      uuid((await params).id),
      actor,
      body.revision,
      body.retry,
    );
  });
}
