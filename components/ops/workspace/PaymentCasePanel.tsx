"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PaymentAttempt, PaymentCase } from "@/lib/ops/payment-policy";
import {
  paymentAmountText,
  paymentDisplayStatus,
  paymentInvoiceSourceUrl,
  paymentNextStep,
  paymentReminderPlan,
  type paymentCaseView,
  type paymentHumanHandoff,
} from "@/lib/ops/payment-display";
import { Chip, fullDate, Icon } from "./WorkspaceUI";

export type PaymentView = ReturnType<typeof paymentCaseView>;
export type PaymentDetail = {
  payment_case: PaymentCase;
  human_followup?: ReturnType<typeof paymentHumanHandoff>;
  attempts: PaymentAttempt[];
  events: { id: string; source: string; event_type: string; occurred_at: string; created_at: string }[];
  view?: PaymentView;
};

const statusLabels: Record<ReturnType<typeof paymentDisplayStatus>, { label: string; tone: "attn" | "ok" | "bad" | undefined }> = {
  unpaid: { label: "Unpaid", tone: "attn" },
  paid: { label: "Paid", tone: "ok" },
  voided: { label: "Invoice voided", tone: undefined },
  cancelled: { label: "Cancelled", tone: undefined },
  needs_person: { label: "Needs a person", tone: "attn" },
};

function safeStripeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "invoice.stripe.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Pure summary. Renders from the case alone; richer detail fills in once loaded. */
export function PaymentCaseSummary({
  payment,
  remindersEnabled,
  detail,
  showTaskLink = true,
}: {
  payment: PaymentCase;
  remindersEnabled: boolean | null;
  detail?: PaymentDetail | null;
  showTaskLink?: boolean;
}) {
  const current = detail?.payment_case || payment;
  const view = detail?.view;
  const status = paymentDisplayStatus(current);
  const next = paymentNextStep(current, detail?.attempts ?? null);
  const plan = paymentReminderPlan(current.first_failed_at, detail?.attempts?.find((a) => a.step_key === "first")?.verified_sent_at || null);
  const sent = (detail?.attempts || []).filter((a) => a.receipt_verified);
  const sentFirst = sent.find((a) => a.step_key === "first")?.verified_sent_at;
  const sentSecond = sent.find((a) => a.step_key === "second")?.verified_sent_at;
  const stripeUrl = paymentInvoiceSourceUrl(current);
  const invoiceUrl = safeStripeUrl(current.hosted_invoice_url);
  const closed = ["paid", "void", "cancelled"].includes(current.state);
  const stopped = next.kind === "stopped";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight">{paymentAmountText(current)}</p>
          <p className="ws-caption mt-0.5">
            {current.invoice_number ? `Invoice ${current.invoice_number}` : "Invoice number not recorded"}
            {view?.stripe_account_label ? ` · ${view.stripe_account_label}` : ""}
          </p>
        </div>
        <Chip tone={statusLabels[status].tone}>{statusLabels[status].label}</Chip>
      </div>

      <div className="ws-section">
        <h3 className="ws-h3">Reminders</h3>
        {remindersEnabled === null && <p className="ws-note is-attn mb-3">Reminder settings have not been confirmed. Refresh before relying on these dates.</p>}
        {remindersEnabled === false && !closed && <p className="ws-note mb-3">Automatic reminders are off. Eimear chases this one; nothing is sent from here.</p>}
        {closed ? (
          <p className="ws-caption">{next.detail}</p>
        ) : (
          <div className="ws-timeline">
            <div className={`ws-step ${sentFirst ? "is-done" : next.step === "first" ? "is-next" : ""}`}>
              <span className="ws-step-dot" />
              <div>
                <strong>Reminder 1</strong>
                <span>{sentFirst ? `Sent ${fullDate(sentFirst)}` : plan ? `Planned ${fullDate(plan.first)} · next working day after the failure` : "Timing needs checking"}</span>
              </div>
            </div>
            <div className={`ws-step ${sentSecond ? "is-done" : next.step === "second" ? "is-next" : ""}`}>
              <span className="ws-step-dot" />
              <div>
                <strong>Reminder 2</strong>
                <span>
                  {sentSecond ? `Sent ${fullDate(sentSecond)}` : plan ? `Planned ${fullDate(plan.second)} · 48 hours after reminder 1` : "After reminder 1"}
                  {!sentSecond && plan?.second_on_weekend ? " (lands on a weekend)" : ""}
                </span>
              </div>
            </div>
            <div className={`ws-step ${stopped ? "is-stop" : ""}`}>
              <span className="ws-step-dot" />
              <div>
                <strong>Then Eimear</strong>
                <span>{stopped ? next.title : "Follows up personally if still unpaid."}</span>
              </div>
            </div>
          </div>
        )}
        {!closed && (
          <div className={`ws-note mt-3 ${next.kind === "planned" ? "is-info" : "is-attn"}`}>
            <Icon name={next.kind === "planned" ? "clock" : "alert"} size={16} className="mt-0.5 flex-none" />
            <span>
              <strong>{next.kind === "planned" ? "Nothing to do yet" : next.title}</strong>
              <span className="mt-0.5 block">{next.detail}</span>
            </span>
          </div>
        )}
        {view?.eimear_note && (
          <p className="ws-prose mt-3">
            <strong>Eimear’s note:</strong> {view.eimear_note}
          </p>
        )}
      </div>

      <div className="ws-section flex flex-wrap gap-2">
        {stripeUrl && (
          <a className="ws-btn" href={stripeUrl} target="_blank" rel="noreferrer">
            Open in Stripe <Icon name="external" size={13} />
          </a>
        )}
        {invoiceUrl && (
          <a className="ws-btn" href={invoiceUrl} target="_blank" rel="noreferrer">
            Client invoice <Icon name="external" size={13} />
          </a>
        )}
        {showTaskLink && current.task_id && (
          <Link className="ws-btn" href={`/admin/work?task=${encodeURIComponent(current.task_id)}`}>
            Eimear’s task
          </Link>
        )}
      </div>

      <details className="ws-details mt-5">
        <summary>Details</summary>
        <dl className="ws-kv mt-3">
          <dt>Client</dt><dd>{current.customer_name || current.contact_email || "Not matched"}</dd>
          <dt>Email</dt><dd>{current.contact_email || "Not recorded"}</dd>
          <dt>CRM contact</dt><dd>{current.contact_id ? `Matched${view?.enrolled_at ? `, added to workflow ${fullDate(view.enrolled_at)}` : ""}` : "Not matched"}</dd>
          <dt>Workflow</dt><dd>{current.latest_delivery || "Not started"}</dd>
          <dt>First failure</dt><dd>{fullDate(current.first_failed_at)}</dd>
          <dt>Last checked</dt><dd>{fullDate(current.source_verified_at)}</dd>
          <dt>Invoice ID</dt><dd className="break-all text-xs">{current.invoice_id}</dd>
          <dt>Account</dt><dd className="break-all text-xs">{current.stripe_account_id}</dd>
        </dl>
        {detail?.events?.length ? (
          <ul className="mt-3 space-y-1 text-xs text-[color:var(--ws-ink-3)]">
            {detail.events.slice(0, 12).map((e) => (
              <li key={e.id}>{fullDate(e.occurred_at)} · {e.source} · {e.event_type.replaceAll("_", " ")}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </div>
  );
}

/** Loads one case and renders the summary. */
export function PaymentCasePanel({
  paymentId,
  initial,
  remindersEnabled,
  showTaskLink,
}: {
  paymentId: string;
  initial?: PaymentCase | null;
  remindersEnabled: boolean | null;
  showTaskLink?: boolean;
}) {
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError("");
    setLoading(true);
    (async () => {
      try {
        const response = await fetch(`/api/admin/ops/payment-cases/${paymentId}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || result.payment_case?.id !== paymentId || !Array.isArray(result.attempts) || !Array.isArray(result.events))
          throw new Error("The saved reminder history could not be checked.");
        if (!controller.signal.aborted) setDetail(result);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The saved reminder history could not be checked.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [paymentId]);
  if (!detail && !initial) {
    return loading ? <p role="status" className="ws-caption">Checking the payment…</p> : <p role="alert" className="ws-note is-bad">{error || "This payment could not be loaded."}</p>;
  }
  return (
    <>
      {error && <p role="alert" className="ws-note is-attn mb-4">{error}</p>}
      <PaymentCaseSummary payment={(detail?.payment_case || initial) as PaymentCase} detail={detail} remindersEnabled={remindersEnabled} showTaskLink={showTaskLink} />
    </>
  );
}
