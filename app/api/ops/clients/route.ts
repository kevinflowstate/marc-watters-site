import { respond } from "@/lib/ops/http";
import { requireOps } from "@/lib/ops/auth";
import { listClients } from "@/lib/ops/clients";
export async function GET(request: Request) {
  return respond(async () => {
    requireOps(request);
    return { clients: await listClients() };
  });
}
