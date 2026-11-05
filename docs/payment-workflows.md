# Failed payment → CRM WhatsApp → portal follow-up

The build tracks each **Stripe merchant account + invoice** separately. One client's paid invoice cannot close another unpaid invoice. The portal shows a named item for Eimear, the current Stripe state and actual reminder evidence. Codex can prepare wording or explain the exception; it does not decide that money was received.

## What is implemented

1. Stripe sends a signed invoice event to `/api/webhooks/stripe-ops/{account-alias}`. The server verifies raw-body signature, freshness, merchant identity and live/test mode, then fetches the current invoice/subscription. The old failure event alone cannot reopen an already-paid invoice.
2. An atomic case/event ledger deduplicates events. One task per case is created/updated in Eimear's workspace. Current Stripe settlement closes only that case's task. Pause, cancellation, uncollectible/unknown state, DND, replies needing a person and failed/unverified message delivery remain explicit review conditions.
3. Before each agreed reminder, GHL calls the case's preflight endpoint. The server rechecks Stripe, Marc's CRM location/contact and current DND, verified WhatsApp opt-in, agreed hours/timing, prior receipts and reminder limit.
4. An atomic reservation grants **one send authorisation per invoice/step**. A repeated preflight returns `authorised_send:false`; it cannot grant another reminder. Missing/uncertain outcomes are retained for investigation, never blindly reset.
5. GHL sends the approved native template only when preflight's saved response grants it. A callback carries that run's case/account/invoice/contact/attempt values. A contact-level mutable “current invoice” field is not execution authority.
6. Actual sent/delivered receipts require server-side message readback: exact message ID, Marc location, contact, outbound WhatsApp type, reserved body hash and reservation time window. A node completing or “Valid WhatsApp” branch is workflow-reported progress, not delivery proof. No message ID/readback means `unknown`, no verified chase count and no next reminder.
7. A reply needing review or DND stops all bound cases for that contact. Paid/paused/cancelled status is checked again before any subsequent attempt. Payment-case tasks remain open until Stripe confirms settlement; successful WhatsApp delivery does not complete the payment task.

This code does not send messages itself. Actual reminder workflows are separate inactive drafts until the account-specific checks below pass.

## Endpoint contract

| Endpoint                                                 | Authentication                                  | Purpose                                                        |
| -------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| POST `/api/webhooks/stripe-ops/{account-alias}`          | Stripe-Signature and configured merchant secret | Authoritative invoice events/current-state refresh             |
| POST `/api/webhooks/ghl-payment` with `schema_version:2` | `x-payment-workflow-secret`                     | Reminder progress, verified provider readback, reply/DND/pause |
| GET `/api/ops/payment-cases`                             | Scoped token `payments:read`                    | Up to 500 recent cases                                         |
| GET `/api/ops/payment-cases/{id}`                        | Scoped token `payments:read`                    | One case, attempts and latest 50 event headers                 |
| POST `/api/ops/payment-reminders/preflight` | `x-payment-workflow-secret` | Body `{ "location_id":"93GJEdsr0cT9el3OINXq", "contact_id":"...", "step_key":"first" }`; resolve exactly one bound case and reserve only |
| POST `/api/ops/payment-cases/{id}/preflight`             | `x-payment-workflow-secret`                     | Body `{ "step_key":"first" }`; check and reserve only          |

The preflight response includes `authorised_send`, reason or reserved attempt, case/account/invoice IDs, fixed contact/location, approved template ID and rendered body. A Stripe hosted invoice URL is supplied only when available and is required only when the approved template actually uses it. When authorised, the attempt has `id` and `expires_at` (two minutes). Never put this protected response or workflow secret in browser code/public artifacts. The GHL workflow must carry it per enrollment and send immediately; expiry never makes a reservation eligible for automatic retry.

GHL callback example (synthetic IDs):

```json
{
  "schema_version": 2,
  "stripe_account_id": "acct_example",
  "invoice_id": "in_example",
  "location_id": "93GJEdsr0cT9el3OINXq",
  "contact_id": "verifiedContactId",
  "external_id": "stable-message-status-event-id",
  "event_type": "reminder_delivered",
  "occurred_at": "2026-11-05T12:01:00Z",
  "attempt_id": "11111111-1111-4111-8111-111111111111",
  "provider_message_id": "actualMessageId"
}
```

Allowed event types: `reminder_requested`, `reminder_sent`, `reminder_delivered`, `reminder_failed`, `reply_needs_human`, `contact_dnd`, `manual_pause`. GHL cannot assert `payment_succeeded` or a new authoritative unpaid state. It cannot supply its own `receipt_verified`, expected hash or delivery state. A verified receipt is computed by the server.

## Proposed GHL workflows

| Draft                            | Trigger and steps                                                                                                                                                                                                 | Portal result                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Failed payment                   | Correct failed-payment trigger; obtain the existing verified case/context; preflight first step; If/Else on `authorised_send`; native approved WhatsApp; context-bound callback; agreed wait; preflight next step | One unpaid case with exact reminder attempt/receipt                               |
| Payment resolved                 | Signed Stripe payment/void/cancellation handlers update the case; GHL paid trigger exits its enrollment too                                                                                                       | Matching invoice settlement closes its task; other unpaid invoices remain visible |
| Reply / DND / pause              | Verified contact reply or opt-out event; preserve relevant run context; callback stop condition; remove matching reminder enrollments                                                                             | Follow-up stopped and Eimear review item retained                                 |
| Message failed / outcome unknown | Failed native send or unavailable receipt                                                                                                                                                                         | No next reminder; Eimear investigates actual outcome before any retry             |

Native GHL payment triggers may only cover payments known to that GHL sub-account. Both external Stripe merchant accounts require their own signed event registration or a separately verified trusted bridge. Do not assume an “External” source filter captures every direct Stripe invoice. Existing successful-payment/onboarding workflows stay unchanged during this build.

The initial failed-payment event does not automatically create a fully bound sending enrollment in this code. Before activating a workflow, prove how its run obtains the correct server case ID and immutable account/invoice context, and how it receives a message ID. Where the builder cannot preserve those values or disable duplicate native action retries, keep it draft/manual. Preflight prevents duplicate grants; it cannot retract a native message already queued after a payment or control the provider's internal retries.

## Configuration and activation

All settings are server-only; no real tokens or account secrets belong in Git:

- `OPS_STRIPE_PAYMENT_ACCOUNTS_JSON`: object keyed by chosen account aliases, each `{account_id,api_key,webhook_secret,livemode}`. Register a separate signed endpoint for each merchant. Account and invoice reads must be permitted; restricted keys that cannot prove merchant identity leave the path blocked.
- `OPS_GHL_PAYMENT_TOKEN`: narrowly scoped Marc-location token for location/contact/message reads. Message read uses its documented Version `v3`; location/contact reads use `2021-07-28`. Required message statuses/body shape still need a real account readback test.
- `OPS_PAYMENT_WORKFLOW_SECRET`: dedicated CRM/preflight shared secret, separate from the old generic webhook token.
- `OPS_PAYMENT_REMINDERS_ENABLED`: **false/unset by default**. Explicit approved activation is required in addition to an enabled rules document.
- `OPS_PAYMENT_RULES_JSON`: reviewed `revision`, `approved_by`, `approved_at`, Marc location, Europe/London timezone, `max_reminders`, agreed local hours, approved calendar timing, ordered first/second template steps and approved body templates. `fixtures/payments/rules.example.json` is disabled, records Kevin's confirmed calendar timing and keeps real template IDs unset pending approval. Templates outside the open WhatsApp conversation window need the provider's appropriate approval, and actual opt-in remains necessary.
- Each case needs an authenticated-admin contact binding and WhatsApp permission evidence. `bindPaymentContact(caseId,{contact_id,whatsapp_opt_in,consent_reference},adminUserId)` checks location/contact and persists the decision. Sending to a person is not authorised by an email-only match or client payload. Existing attempts prevent rebinding until explicitly reconciled.

Optional WhatsApp footers stay blank in accordance with Kevin's instruction; actual DND/opt-outs are still honoured. Candidate wording is in the disabled example file and needs exact template/body approval before activation.

## Recovery and tests

Do not delete or automatically recycle a reserved/unknown/failed attempt. Check actual provider state and record a new specifically approved reconciliation path before permitting another attempt; an administrative reset UI is intentionally absent. There is no automatic unpause/re-enable after a reply or DND.

Current invoice webhook handling is synchronous. A subscription update refreshes up to 100 existing unpaid cases; an excessive backlog fails clearly for manual/queued reconciliation. Large-scale durable event queueing is a future deployment requirement, not a claim that a serverless callback runs forever. Provider retries are safe at the per-account/invoice event ledger.

Run `npx vitest run tests/ops-payment-policy.test.ts`. After applying migrations 024 and 026 **only to the authorised non-live database**, execute `fixtures/payments/acceptance.sql`: it proves invoice/merchant independence, duplicates, old failures after payment, one-use reservation, workflow status versus verified receipt and DND, then rolls back all fixtures. Test body hashes, wrong account/mode, source freshness, sending hours/DST, missing opt-in and blocked sends without making a real message/charge.

Sources checked 5 November 2026: [Stripe event management](https://docs.stripe.com/events/manage-webhook-endpoints), [Stripe invoice object](https://docs.stripe.com/api/invoices/object), [Stripe's webhook signature implementation](https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts), [GHL Get Message](https://marketplace.gohighlevel.com/docs/ghl/conversations/get-message/index.html). Account-specific GHL builder observations are recorded separately by the root task.

## Sender capability check — 5 November 2026

The documented [GHL Send a new message API](https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message/index.html) accepts a sub-account PIT with `conversations/message.write`, Version `v3`, `type:WhatsApp`, `templateId`, `message` and sender/recipient fields. Its current public schema does **not establish per-request WhatsApp template variable/component mapping**: its `whatsapp` object describes media only. A generic `templateId` plus `message` is not evidence that approved-template variables will receive this reserved invoice's values. No undocumented parameter or sender adapter has been invented.

Root's native builder inspection also found mandatory template-level custom-variable mapping, without verified per-enrollment invoice mapping. Root saved an inactive failed-payment trigger draft (`5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed`). The later root checkpoint reports utility template `cbb_payment_issue_v1`, language `en_GB`, pending Meta approval, with only the contact first-name variable. No send action or enrollment was activated. Existing connected sender status does not close these gaps.

There is also an approved-template link-format dependency. GHL's [URL-variable guidance](https://help.gohighlevel.com/support/solutions/articles/155000006052/create_ticket) explains that a full invoice URL in a body variable can be rejected; it recommends an approved static link or a CTA button with a dynamic suffix. Any future invoice-link body-variable wording and its body-hash treatment remain test preparation. Before production, agree the approved body/button layout, bind the exact button URL/parameters into the reservation and verify the actual provider-rendered message. Do not submit an unsuitable template merely to fill an ID.

**Sending is blocked pending one demonstrated supported path:** native GHL workflow variables preserved per enrollment through preflight, template action and receipt; or a documented supported PIT template-parameter contract confirmed by GHL. Keep the native workflow inactive and use human review meanwhile. Do not store a single mutable current invoice/attempt on the contact, send free-form text outside its permitted window, substitute an unrelated marketing template or introduce a separate Meta credential/sender architecture in this build. Preflight/reservation and provider receipt handling are implemented foundations; the actual sender bridge is not complete.

## First practical version: ask for a reply

The first reminder can avoid invoice URLs, amounts and invoice-number variables entirely:

> Hi {{first_name}}, it's Eimear from Construction Business Blueprint. A payment on your account hasn't gone through. Please reply here and I'll help you get it sorted.

This approved-template candidate uses only the native contact first-name mapping. Approved rules now permit that body without a payment-link placeholder. Preflight renders `{{first_name}}` from the freshly verified GHL contact's `firstName`, so its expected body matches the native source; it does not substitute a different Stripe customer name. A missing CRM first name blocks that template. The invoice and merchant still remain in the server's authoritative payment checks, task and reservation.

For a contact-triggered workflow, `paymentReminderPreflightForContact(contactId,{step_key})` resolves exactly one bound unpaid case and calls the full case preflight. Several unresolved invoices, unknown/paused/uncollectible state or a changed contact binding hold for human review rather than selecting an arbitrary invoice. The helper rechecks the candidate after provider reads, and the existing case revision/reservation checks still apply. The authenticated workflow route `/api/ops/payment-reminders/preflight` exposes it; this route grants a reservation and does not send.

The native template therefore does not need contact-level “current invoice” fields. GHL still needs to branch on an actual preflight grant before its send action. Receipt mapping, native action retry/re-entry behaviour, actual template approval and a controlled end-to-end test remain required; absent a verified receipt, preserve unknown status and do not automatically send a second reminder. Eimear handles the reply through the normal conversation and payment resolution path. Invoice-specific links/components can be added later through a separately verified contract.

## Confirmed timing and final human handoff

Kevin approved this sequence in the current setup session:

1. First reminder at **09:00 Europe/London on the next working weekday after the failure**. A Friday/weekend failure rolls to Monday.
2. One follow-up **three calendar days after the provider-verified first send**, scheduled at 09:00 London and rolled forward to Monday if the due date is a weekend.
3. After the second verified sent/delivered receipt, the same unpaid case becomes **Eimear's personal follow-up**. Automatic reminders end; there is no third reminder.

Calendar arithmetic uses local dates, so daylight saving changes preserve 09:00 rather than adding fixed 24/72-hour durations. Working weekdays here mean Monday–Friday; a bank-holiday calendar is not configured. A missed schedule is held by the configured sending-hours guard; it is not permission to message overnight or at weekends. The disabled example uses the 09:00 scheduling hour (09:00–09:59) as its narrow execution window.

Follow-up timing requires a server-verified message receipt and its provider `dateAdded` timestamp, retained as `verified_sent_at`. Caller-supplied callback time and workflow progress are insufficient. Existing earlier receipts lacking that retained timestamp need actual provider reconciliation; no timestamp is invented or backfilled from an untrusted callback.

Additive migration **026** keeps already-applied 024 unchanged. It adds the verified send timestamp, a SQL London-calendar due calculator, strict first/second-only reservations, the two-attempt ceiling and explicit Eimear handoff wording/assignment. Client/scoped read tokens cannot bypass these service-only transitions. `fixtures/payments/calendar-acceptance.sql` verifies calendar/DST dates, two verified receipts, the final human task and refusal of a third reminder, then rolls back fixtures.

The confirmed timing does not activate messages: `OPS_PAYMENT_REMINDERS_ENABLED` and the example remain false. `cbb_payment_issue_v1` and `cbb_payment_followup_v1` were both observed Pending in GHL at 22:32 London on 5 November. Both are Utility, English (UK), with native Contact → First Name mapping, no footer and no buttons. Actual approved template IDs, safe native workflow mapping and receipt proof remain activation prerequisites. Neither template has been sent to a client.
