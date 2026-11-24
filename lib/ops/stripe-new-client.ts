import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { activateClient, type Activation } from "./client-activation";
import { startOnboarding } from "./onboarding";
import { createTask } from "./tasks";
import type { StripePaymentAccount } from "./payment-stripe";

/**
 * Marc takes most payments directly in Stripe, so a payment is the best sign a new client has
 * joined. Rules (all idempotent, so Stripe retries are harmless):
 * - payer is a portal client added in the last 30 days -> their onboarding checklist starts;
 * - payer is an older portal client -> nothing (an instalment or renewal);
 * - payer is not in the portal and this is the customer's first paid invoice ever (no earlier paid
 *   invoice and no earlier successful payment) -> they are added to the portal, get the welcome
 *   email, and their onboarding checklist starts (Kevin, 16 Nov 2026);
 * - anything else not in the portal (a payment link with no invoice, history Stripe could not
 *   confirm, no name on the invoice, an archived client) -> one task for Eimear to check and invite.
 */

const NEW_CLIENT_DAYS = 30;

type Client = { id: string; onboarding_stage: string; archived_at: string | null; created_at: string };
type Deps = {
  fetch?: typeof fetch;
  findClient?: (email: string) => Promise<Client | "manual_intake" | null>;
  start?: (clientId: string) => Promise<unknown>;
  raiseTask?: typeof createTask;
  activate?: (name: string, email: string) => Promise<Activation>;
  now?: Date;
};

const clean = (v: unknown, max = 120) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) : "";

async function findClientByEmail(email: string): Promise<Client | "manual_intake" | null> {
  const db = createAdminClient();
  const user = await db.from("users").select("id").eq("email", email).limit(1).maybeSingle();
  if (user.error) throw new Error("client lookup failed");
  if (!user.data) {
    const manual = await db.from("client_manual_intakes").select("state").eq("email", email).maybeSingle();
    if (manual.error) throw new Error("manual intake lookup failed");
    return manual.data ? "manual_intake" : null;
  }
  const profile = await db
    .from("client_profiles")
    .select("id,onboarding_stage,archived_at,created_at")
    .eq("user_id", user.data.id)
    .maybeSingle();
  if (profile.error) throw new Error("client lookup failed");
  return (profile.data as Client | null) ?? null;
}

async function stripeRows(account: StripePaymentAccount, path: string, q: URLSearchParams, f: typeof fetch) {
  const r = await f(`https://api.stripe.com/v1/${path}?${q}`, {
    headers: { Authorization: `Bearer ${account.api_key}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!r.ok) return null;
  return ((await r.json()) as { data?: Record<string, unknown>[] }).data ?? [];
}

/**
 * Has this customer paid before? "earlier": an earlier paid invoice, or a successful payment from
 * before this invoice was raised (a payment link, say). "unknown": Stripe could not answer.
 */
async function paymentHistory(
  account: StripePaymentAccount,
  customer: string,
  invoiceId: string,
  invoiceCreated: number,
  f: typeof fetch,
): Promise<"first" | "earlier" | "unknown"> {
  try {
    const invoices = await stripeRows(account, "invoices", new URLSearchParams({ customer, status: "paid", limit: "10" }), f);
    if (!invoices) return "unknown";
    if (invoices.some((i) => i.id !== invoiceId && Number(i.amount_paid) > 0)) return "earlier";
    if (!(invoiceCreated > 0)) return "unknown";
    const charges = await stripeRows(account, "charges", new URLSearchParams({ customer, "created[lt]": String(invoiceCreated), limit: "10" }), f);
    if (!charges) return "unknown";
    return charges.some((c) => c.status === "succeeded" && c.paid === true && Number(c.amount) > 0) ? "earlier" : "first";
  } catch {
    return "unknown";
  }
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
      created: Number(object.created),
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
      created: Number(object.created),
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
  if (client === "manual_intake") return { action: "manual_intake_in_progress" as const };
  const now = deps.now ?? new Date();
  const start = deps.start ?? startOnboarding;
  if (client && !client.archived_at) {
    const recent = now.getTime() - Date.parse(client.created_at) < NEW_CLIENT_DAYS * 86_400_000;
    if (!recent || client.onboarding_stage === "complete") return { action: "existing_client" as const };
    await start(client.id);
    return { action: "checklist_started" as const, client_id: client.id };
  }

  const name = pay.name || pay.email;
  const paid = new Intl.NumberFormat("en-GB", { style: "currency", currency: pay.currency.toUpperCase() }).format(pay.amount / 100);
  const where = `${account.label || account.alias} in Stripe`;
  let note = "";

  if (type === "invoice.paid" && /^cus_[A-Za-z0-9]+$/.test(pay.customer)) {
    const history = await paymentHistory(account, pay.customer, pay.id, pay.created, deps.fetch ?? fetch);
    if (history === "earlier") return { action: "existing_customer" as const };
    if (history === "unknown") note = "Stripe could not confirm whether they have paid before, so they were not added automatically.";
    else if (client?.archived_at) note = "They have an archived portal account, so they were not added automatically.";
    else if (!pay.name) note = "The invoice has no customer name, so they were not added automatically.";
    else {
      const result = await (deps.activate ?? activateClient)(pay.name, pay.email);
      if (result.status === "created") {
        // The account is live; the checklist is best effort and never undoes it.
        let checklist = true;
        try {
          await start(result.profileId);
        } catch (e) {
          checklist = false;
          console.error("[STRIPE INTAKE] Onboarding checklist failed:", e instanceof Error ? e.message : e);
        }
        if (!result.emailSent || !checklist) {
          await raise(deps, pay.email, `New client added · ${name} · needs a check`, [
            `${name} (${pay.email}) paid ${paid} to ${where} (their first invoice) and was added to the portal automatically.`,
            !result.emailSent ? "The welcome email did NOT send. Open Clients and resend their invite." : "",
            !checklist ? "Their onboarding checklist did not start. Open the client and start onboarding." : "",
          ]);
        }
        return { action: "client_added" as const, client_id: result.profileId, email_sent: result.emailSent, checklist_started: checklist };
      }
      if (result.status === "exists") note = "An account with this email already exists in the portal (not as an active client), so nothing was created.";
      else note = result.userId
        ? `Adding them automatically stopped part-way (${result.error}). Their login exists but may be incomplete: check Clients before inviting.`
        : `Adding them automatically failed (${result.error}). Nothing was created.`;
    }
  }

  await raise(deps, pay.email, `New client paid · ${name}`, [
    `${name} (${pay.email}) paid ${paid} to ${where} and is not in the portal yet.`,
    note,
    "If they are a new programme client, open Clients and use Invite client with this email. Their onboarding checklist then appears here automatically. If it was something else (an event ticket, for example), mark this done with a note. Nothing has been sent to them.",
  ], pay.id);
  return { action: "setup_task" as const };
}

async function raise(deps: Deps, email: string, title: string, lines: string[], paymentId?: string) {
  const ref = createHash("sha256").update(email).digest("hex").slice(0, 32);
  await (deps.raiseTask ?? createTask)(
    {
      kind: "task",
      area: "onboarding",
      assignee: "eimear",
      source: "system",
      priority: 1,
      external_ref: `onboarding-stripe:${ref}`,
      title,
      detail: lines.filter(Boolean).join("\n\n"),
      payload: { ...(paymentId ? { stripe_payment: paymentId } : {}), email },
    },
    "system",
  );
}
