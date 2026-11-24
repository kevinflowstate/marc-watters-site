import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { OpsError } from "./tasks";

export type PaymentRun = {
  case_id: string;
  contact_id: string;
  invoice_id: string;
  stripe_account_id: string;
};

function signature(payload: string) {
  const key = getEnv("OPS_PAYMENT_WORKFLOW_SECRET");
  if (!key) throw new OpsError("Payment workflow secret unavailable", 503);
  return createHmac("sha256", key)
    .update("native-payment-run-v1/" + payload)
    .digest();
}

export function signPaymentRun(run: PaymentRun) {
  const payload = Buffer.from(JSON.stringify(run)).toString("base64url");
  return payload + "." + signature(payload).toString("base64url");
}

export function verifyPaymentRun(input: unknown, contact: unknown): PaymentRun {
  if (
    typeof input !== "string" ||
    input.length > 1200 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(input)
  )
    throw new OpsError("The original signed payment run is required", 422);
  const [payload, sig] = input.split(".");
  if (!timingSafeEqual(signature(payload), Buffer.from(sig, "base64url")))
    throw new OpsError(
      "Payment run does not match its original enrolment",
      422,
    );
  const run = JSON.parse(
    Buffer.from(payload, "base64url").toString(),
  ) as PaymentRun;
  if (
    !run ||
    run.contact_id !== contact ||
    !/^[a-f0-9-]{36}$/i.test(run.case_id) ||
    !/^in_[A-Za-z0-9]+$/.test(run.invoice_id) ||
    !/^acct_[A-Za-z0-9]+$/.test(run.stripe_account_id)
  )
    throw new OpsError("Payment run identity does not match", 422);
  return run;
}
