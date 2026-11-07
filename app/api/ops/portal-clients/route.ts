import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import { listPortalClients } from "@/lib/ops/portal-monitor";

export async function GET(request: Request) {
  return respond(async () => {
    requireOpsScope(request, "portal:read");
    return listPortalClients(new URL(request.url).searchParams);
  });
}
