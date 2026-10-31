import { respond } from "@/lib/ops/http";
import { requireOps } from "@/lib/ops/auth";
import { listLessons } from "@/lib/ops/lessons";
export async function GET(request: Request) {
  return respond(async () => {
    requireOps(request);
    return { lessons: await listLessons() };
  });
}
