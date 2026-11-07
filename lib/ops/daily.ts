import { createAdminClient } from "@/lib/supabase/admin";
import { listClients } from "./clients";
import { createTask, listTasks, OpsError } from "./tasks";
function isoWeek(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  return `${year}-W${String(Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}
export async function runDaily(now = new Date()) {
  const clients = await listClients(),
    open = await listTasks(),
    ids: string[] = [];
  const make = async (
    title: string,
    area: string,
    ref: string,
    clientId?: string,
    detail?: string,
    kind: "flag" | "task" = "flag",
  ) => {
    const t = await createTask({
      kind,
      title,
      area,
      external_ref: ref,
      ...(clientId ? { client_id: clientId } : {}),
      detail,
    });
    ids.push(t.id);
  };
  for (const c of clients) {
    if (c.archived_at) continue;
    const name = c.users?.full_name || c.business_name || "client";
    if (
      c.onboarding_due_at &&
      c.onboarding_stage !== "complete" &&
      Date.parse(c.onboarding_due_at) < now.getTime()
    )
      await make(
        `onboarding: follow up with ${name}`,
        "onboarding",
        `onboarding-due:${c.id}:${c.onboarding_due_at}`,
        c.id,
      );
    if (
      c.payment_status === "chasing" &&
      Date.parse(c.payment_status_updated_at) < now.getTime() - 7 * 86400000
    )
      await make(
        `payments: review follow-up for ${name}`,
        "payments",
        `payment-stale:${c.id}:${c.payment_status_updated_at}`,
        c.id,
      );
    if (
      Date.parse(c.last_checkin || c.created_at) <
        now.getTime() - 14 * 86400000 &&
      !open.some(
        (t) =>
          t.client_id === c.id &&
          t.area === "engagement" &&
          !["done", "cancelled", "rejected"].includes(t.status),
      )
    )
      await make(
        `engagement: check in with ${name}`,
        "engagement",
        `engagement:${c.id}:${isoWeek(now)}`,
        c.id,
      );
  }
  if (now.getUTCDay() === 1)
    await make(
      "payments: weekly review",
      "payments",
      `payments-weekly:${isoWeek(now)}`,
      undefined,
      clients
        .filter((c) => !c.archived_at && c.payment_status !== "current")
        .map((c) => `${c.users?.full_name || c.id}: ${c.payment_status}`)
        .join("\n") || "All connected clients are current.",
      "task",
    );
  return { task_ids: [...new Set(ids)], checked_clients: clients.length };
}
