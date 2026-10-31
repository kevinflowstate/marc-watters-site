import { respond } from "@/lib/ops/http";
import { requireOps } from "@/lib/ops/auth";
import { getClient } from "@/lib/ops/clients";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, c: Context) {
  return respond(async () => {
    requireOps(request);
    const { id } = await c.params;
    return { client: await getClient(id) };
  });
}
