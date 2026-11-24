import { respond } from "@/lib/ops/http";
import { requireCron } from "@/lib/ops/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError } from "@/lib/ops/tasks";
import { runDaily } from "@/lib/ops/daily";
export async function GET(request: Request) {
  return respond(async () => {
    requireCron(request);
    const result = await runDaily();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const renewal = await createAdminClient().rpc("cbb_due_contract_reviews", {
      p_today: today,
    });
    if (renewal.error)
      throw new OpsError("Contract reviews could not be checked", 503);
    return { ...result, renewal_tasks_created: renewal.data };
  });
}
