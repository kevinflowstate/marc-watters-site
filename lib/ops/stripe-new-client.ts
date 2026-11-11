import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { startOnboarding } from "./onboarding";
import { createTask } from "./tasks";
import type { StripePaymentAccount } from "./payment-stripe";

/**
 * Marc takes most payments directly in Stripe, so a payment is the best sign a new client has
 * joined. Rules (all idempotent, so Stripe retries are harmless):
 * - payer is a portal client added in the last 30 days -> their onboarding checklist starts;
 * - payer is an older portal client -> nothing (an instalment or renewal);
 * - payer is not in the portal -> one task for Eimear to check and invite them, which then starts
 *   the checklist automatically.
 * Nothing here creates an account, invitation or message.
 */

const NEW_CLIENT_DAYS = 30;

type Client = { id: string; onboarding_stage: string; archived_at: string | null; created_at: string };
type Deps = {
  fetch?: typeof fetch;
  findClient?: (email: string) => Promise<Client | null>;
  start?: (clientId: string) => Promise<unknown>;
  raiseTask?: typeof createTask;
  now?: Date;
};

const clean = (v: unknown, max = 120) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "";

async function findClientByEmail(email: string): Promise<Client | null> {
  const db = createAdminClient();
  const user = await db.from("users").select("id").eq("email", email).limit(1).maybeSingle();
  if (user.error) throw new Error("client lookup failed");
  if (!user.data) return null;
  const profile = await db
    .from("client_profiles")
    .select("id,onboarding_stage,archived_at,created_at")
    .eq("user_id", user.data.id)
    .maybeSingle();
  if (profile.error) throw new Error("client lookup failed");
  return (profile.data as Client | null) ?? null;
}

/** An invoice that is not the customer's first paid one is an existing customer paying again. */
async function hasEarlierPaidInvoice(account: StripePaymentAccount, customer: string, invoiceId: string, f: typeof fetch) {
  const q = new URLSearchParams({ customer, status: "paid", limit: "5" });
  const r = await f(`https://api.stripe.com/v1/invoices?${q}`, {
    headers: { Authorization: `Bearer ${account.api_key}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!r.ok) return false; // unknown history: fall back to the portal's own records
  const body = (await r.json()) as { data?: { id?: string; amount_paid?: number }[] };
  return (body.data || []).some((i) => i.id !== invoiceId && Number(i.amount_paid) > 0);
}

/** Reads the payer from a signature-verified invoice.paid or checkout.session.completed event. */
export function paymentFromEvent(type: string, object: Record<string, unknown>) {
  if (type === "invoice.paid" && object.object === "invoice" && typeof object.id === "string") {
    return {
      id: object.id,
      email: clean(object.customer_email, 254).toLowerCase(),
      name: clean(object.customer_name),
      amount: Number(object.amount_paid),
      currency: String(object.currency || "gbp"),
      customer: typeof object.customer === "string" ? object.customer : "",
      invoice: true,
    };
  }
  if (type === "checkout.session.completed" && object.object === "checkout.session" && typeof object.id === "string" && object.payment_status === "paid") {
    const details = (object.customer_details && typeof object.customer_details === "object" ? object.customer_details : {}) as Record<string, unknown>;
    return {
      id: object.id,
      email: clean(details.email ?? object.customer_email, 254).toLowerCase(),
      name: clean(details.name),
      amount: Number(object.amount_total),
      currency: String(object.currency || "gbp"),
      customer: typeof object.customer === "string" ? object.customer : "",
      // A subscription checkout is followed by its own invoice.paid; handle it once, there.
      invoice: object.mode === "subscription",
    };
  }
  return null;
}

export async function onboardFromPayment(account: StripePaymentAccount, type: string, object: Record<string, unknown>, deps: Deps = {}) {
  const pay = paymentFromEvent(type, object);
  if (!pay || !pay.email.includes("@") || !(pay.amount > 0)) return { action: "ignored" as const };
  if (type === "checkout.session.completed" && pay.invoice) return { action: "ignored" as const };

  const client = await (deps.findClient ?? findClientByEmail)(pay.email);
  const now = deps.now ?? new Date();
  if (client && !client.archived_at) {
    const recent = now.getTime() - Date.parse(client.created_at) < NEW_CLIENT_DAYS * 86_400_000;
    if (!recent || client.onboarding_stage === "complete") return { action: "existing_client" as const };
    await (deps.start ?? startOnboarding)(client.id);
    return { action: "checklist_started" as const, client_id: client.id };
  }
  if (pay.invoice && /^cus_[A-Za-z0-9]+$/.test(pay.customer) &&
      (await hasEarlierPaidInvoice(account, pay.customer, pay.id, deps.fetch ?? fetch)))
    return { action: "existing_customer" as const };

  const name = pay.name || pay.email;
  const paid = new Intl.NumberFormat("en-GB", { style: "currency", currency: pay.currency.toUpperCase() }).format(pay.amount / 100);
  const ref = createHash("sha256").update(pay.email).digest("hex").slice(0, 32);
  await (deps.raiseTask ?? createTask)(
    {
      kind: "task",
      area: "onboarding",
      assignee: "eimear",
      source: "system",
      priority: 1,
      external_ref: `onboarding-stripe:${ref}`,
      title: `New client paid · ${name}`,
      detail: `${name} (${pay.email}) paid ${paid} to ${account.label || account.alias} in Stripe and is not in the portal yet.\n\nIf they are a new programme client, open Clients and use Invite client with this email. Their onboarding checklist then appears here automatically. If it was something else (an event ticket, for example), mark this done with a note. Nothing has been sent to them.`,
      payload: { stripe_payment: pay.id, email: pay.email },
    },
    "system",
  );
  return { action: "setup_task" as const };
}
