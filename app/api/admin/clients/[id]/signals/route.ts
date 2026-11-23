import { respond, adminActor } from "@/lib/ops/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClient } from "@/lib/ops/clients";
import { updateClientSignals } from "@/lib/ops/onboarding";
type C = { params: Promise<{ id: string }> };
export async function GET(_r: Request, c: C) {
  return respond(async () => {
    await adminActor();
    const client = await getClient((await c.params).id);
    const history = await createAdminClient().from("weekly_checkin_reminder_delivery")
      .select("week_start, channel, status, claimed_at")
      .eq("client_id", client.id).order("claimed_at", { ascending: false }).limit(8);
    return { client, reminderHistory: history.error ? null : history.data };
  });
}
export async function PATCH(r: Request, c: C) {
  return respond(async () => {
    const actor = await adminActor();
    return {
      client: await updateClientSignals(
        (await c.params).id,
        await r.json(),
        actor,
      ),
    };
  });
}
