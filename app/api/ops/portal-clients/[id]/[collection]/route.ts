import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import { readPortalCollection } from "@/lib/ops/portal-monitor";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; collection: string }> },
) {
  return respond(async () => {
    requireOpsScope(request, "portal:read");
    const { id, collection } = await context.params;
    return readPortalCollection(id, collection, new URL(request.url).searchParams);
  });
}
