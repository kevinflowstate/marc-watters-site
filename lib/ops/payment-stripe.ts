import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { OpsError, record } from "./tasks";
import { isStripeInvoiceUrl, type PaymentState } from "./payment-policy";

export type StripePaymentAccount = {
  alias: string;
  account_id: string;
  api_key: string;
  webhook_secret: string;
  livemode: boolean;
};
export function stripePaymentAccount(alias: string): StripePaymentAccount {
  let configured: unknown;
  try {
    configured = JSON.parse(getEnv("OPS_STRIPE_PAYMENT_ACCOUNTS_JSON") || "{}");
  } catch {
    throw new OpsError("Stripe payment account configuration is invalid", 503);
  }
  const all = record(configured),
    b = record(all[alias]);
  if (
    !/^[a-z0-9-]{1,60}$/.test(alias) ||
    typeof b.account_id !== "string" ||
    !/^acct_[A-Za-z0-9]+$/.test(b.account_id) ||
    typeof b.api_key !== "string" ||
    !b.api_key ||
    typeof b.webhook_secret !== "string" ||
    !b.webhook_secret ||
    typeof b.livemode !== "boolean"
  )
    throw new OpsError("Stripe payment account is not configured", 503);
  return {
    alias,
    account_id: b.account_id,
    api_key: b.api_key,
    webhook_secret: b.webhook_secret,
    livemode: b.livemode,
  };
}
export function stripePaymentAccountById(accountId: string) {
  let all: Record<string, unknown>;
  try {
    all = record(
      JSON.parse(getEnv("OPS_STRIPE_PAYMENT_ACCOUNTS_JSON") || "{}"),
    );
  } catch {
    throw new OpsError("Stripe payment account configuration is invalid", 503);
  }
  const aliases = Object.keys(all).filter(
    (key) => record(all[key]).account_id === accountId,
  );
  if (aliases.length !== 1)
    throw new OpsError(
      "Unique Stripe payment account configuration required",
      503,
    );
  return stripePaymentAccount(aliases[0]);
}
export function verifyStripePaymentSignature(
  raw: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header || !secret) throw new OpsError("Unauthorized Stripe event", 401);
  const parts = header.split(",").map((part) => part.split("="));
  const times = parts.filter(([key]) => key === "t");
  if (times.length !== 1 || !/^\d+$/.test(times[0][1] || ""))
    throw new OpsError("Unauthorized Stripe event", 401);
  const timestamp = Number(times[0][1]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(now / 1000 - timestamp) > 300
  )
    throw new OpsError("Unauthorized Stripe event", 401);
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest();
  if (
    !parts.some(
      ([key, value]) =>
        key === "v1" &&
        /^[a-f0-9]{64}$/i.test(value || "") &&
        timingSafeEqual(expected, Buffer.from(value, "hex")),
    )
  )
    throw new OpsError("Unauthorized Stripe event", 401);
}

async function stripeRead(
  account: StripePaymentAccount,
  path: string,
  request = fetch,
) {
  const response = await request("https://api.stripe.com/v1" + path, {
    headers: { Authorization: "Bearer " + account.api_key },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok)
    throw new OpsError(
      "Authoritative Stripe read unavailable; follow-up is blocked",
      503,
    );
  return record(await response.json());
}

export async function readStripePaymentSnapshot(
  account: StripePaymentAccount,
  invoiceId: string,
  request = fetch,
) {
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId))
    throw new OpsError("Valid Stripe invoice ID required");
  const identity = await stripeRead(account, "/account", request);
  if (identity.id !== account.account_id)
    throw new OpsError("Stripe merchant identity does not match", 409);
  const invoice = await stripeRead(account, "/invoices/" + invoiceId, request);
  if (
    invoice.id !== invoiceId ||
    invoice.object !== "invoice" ||
    invoice.livemode !== account.livemode
  )
    throw new OpsError("Stripe invoice identity or mode does not match", 409);
  const parent =
    invoice.parent && typeof invoice.parent === "object"
      ? record(invoice.parent)
      : null;
  const detail =
    parent?.subscription_details &&
    typeof parent.subscription_details === "object"
      ? record(parent.subscription_details)
      : null;
  const subscription = detail?.subscription ?? invoice.subscription;
  const subscriptionId =
    typeof subscription === "string"
      ? subscription
      : subscription && typeof subscription === "object"
        ? String(record(subscription).id)
        : null;
  let state: PaymentState =
    (
      {
        open: "unpaid",
        paid: "paid",
        void: "void",
        uncollectible: "uncollectible",
      } as Record<string, PaymentState>
    )[String(invoice.status)] || "unknown";
  if (state === "unpaid" && subscriptionId) {
    if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))
      throw new OpsError("Stripe subscription identity is invalid", 409);
    const sub = await stripeRead(
      account,
      "/subscriptions/" + subscriptionId,
      request,
    );
    if (sub.id !== subscriptionId)
      throw new OpsError("Stripe subscription identity does not match", 409);
    if (sub.status === "canceled" || sub.status === "incomplete_expired")
      state = "cancelled";
    else if (sub.status === "paused" || sub.pause_collection) state = "paused";
  }
  const remaining = invoice.amount_remaining;
  if (
    !Number.isSafeInteger(remaining) ||
    Number(remaining) < 0 ||
    Number(remaining) > 2000000000
  )
    throw new OpsError("Stripe invoice amount is invalid", 409);
  if (state === "unpaid" && remaining === 0) state = "unknown";
  if (
    typeof invoice.currency !== "string" ||
    !/^[a-z]{3}$/i.test(invoice.currency)
  )
    throw new OpsError("Stripe invoice currency is invalid", 409);
  const customer =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer && typeof invoice.customer === "object"
        ? String(record(invoice.customer).id)
        : null;
  return {
    stripe_account_id: account.account_id,
    invoice_id: invoiceId,
    invoice_number:
      typeof invoice.number === "string" ? invoice.number.slice(0, 100) : null,
    stripe_customer_id: customer,
    subscription_id: subscriptionId,
    state,
    amount_minor: Number(remaining),
    currency: invoice.currency.toUpperCase(),
    hosted_invoice_url: isStripeInvoiceUrl(invoice.hosted_invoice_url)
      ? invoice.hosted_invoice_url
      : null,
    contact_email:
      typeof invoice.customer_email === "string"
        ? invoice.customer_email.toLowerCase().slice(0, 320)
        : null,
    customer_name:
      typeof invoice.customer_name === "string"
        ? invoice.customer_name.slice(0, 300)
        : null,
    source_verified_at: new Date().toISOString(),
  };
}
