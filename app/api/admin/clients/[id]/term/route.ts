import { createAdminClient } from "@/lib/supabase/admin";
import { adminActor, respond } from "@/lib/ops/http";
import { OpsError, uuid } from "@/lib/ops/tasks";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return respond(async () => {
    await adminActor();
    const id = uuid((await context.params).id);
    const db = createAdminClient();
    const [terms, details] = await Promise.all([
      db
        .from("client_contract_terms")
        .select("term_end,decision")
        .eq("client_id", id)
        .order("term_end", { ascending: false }),
      db
        .from("client_intake_details")
        .select("home_address,business_address")
        .eq("client_id", id)
        .maybeSingle(),
    ]);
    if (terms.error || details.error)
      throw new OpsError("Could not load contract and delivery details", 503);
    return { terms: terms.data, details: details.data };
  });
}
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const actor = await adminActor();
    const { termEnd, previous, decision } = await request.json();
    if (
      typeof termEnd !== "string" ||
      !/^\d{4}-\d\d-\d\d$/.test(termEnd) ||
      !["pending", "renew_term", "monthly"].includes(decision)
    )
      throw new OpsError("Enter a term end and valid decision.");
    const { error } = await createAdminClient().rpc("cbb_set_contract_term", {
      p_actor: actor,
      p_client: uuid((await context.params).id),
      p_end: termEnd,
      p_previous: previous ?? null,
      p_decision: decision,
    });
    if (error)
      throw new OpsError(
        "The term could not be saved. Refresh the client profile and check the date.",
        409,
      );
    return { success: true };
  });
}
