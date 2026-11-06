import { adminActor, respond } from "@/lib/ops/http";
import { getWorkspace } from "@/lib/ops/workspace-feed";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    await adminActor();
    return getWorkspace();
  });
}
