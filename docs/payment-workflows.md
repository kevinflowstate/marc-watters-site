# Failed payment → CRM WhatsApp → portal follow-up

The build tracks each **Stripe merchant account + invoice** separately. One client's paid invoice cannot close another unpaid invoice. The portal shows a named item for Eimear, the current Stripe state and actual reminder evidence. Codex can prepare wording or explain the exception; it does not decide that money was received.

## What is implemented

1. Stripe sends a signed invoice event to `/api/webhooks/stripe-ops/{account-alias}`. The server verifies raw-body signature, freshness, merchant identity and live/test mode, then fetches the current invoice/subscription. The old failure event alone cannot reopen an already-paid invoice.
2. An atomic case/event ledger deduplicates events. One task per case is created/updated in Eimear's workspace. Current Stripe settlement closes only that case's task. Pause, cancellation, uncollectible/unknown state, DND, replies needing a person and failed/unverified message delivery remain explicit review conditions.
3. Before each agreed reminder, GHL calls the case's preflight endpoint. The server rechecks Stripe, Marc's CRM location/contact and current DND, verified WhatsApp opt-in, agreed hours/timing, prior receipts and reminder limit. The first reservation creates a random server handoff ID; GHL does not need to expose a native enrollment ID.
4. An atomic reservation fixes **one reminder per invoice/step**. It returns `reserved:true`, `authorised_send:false`, an opaque `context_token` and `workflow_run_id`. Save those response values inside that enrollment. A lost or repeated first preflight does not receive another token or reminder; it stays held for review.
5. Immediately before the native action, GHL calls `/api/ops/payment-reminders/dispatch` with those two saved values. The server rechecks the invoice, contact, wording and stop conditions, then atomically returns `authorised_send:true` **once**. Only that response permits the approved native template. Neither a contact field nor the first reservation permits sending. A callback supplies the same saved context and the actual native message ID; the server reconstructs the case/account/invoice/contact/attempt values itself.
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
| POST `/api/ops/payment-cases/{id}/preflight`             | `x-payment-workflow-secret`                     | Follow-up body `{ "step_key":"second", "workflow_run_id":"saved first response value" }`; retain the original case |
| POST `/api/ops/payment-reminders/dispatch` | `x-payment-workflow-secret` | Body `{ "context_token":"saved response token", "workflow_run_id":"saved response value" }`; one final native-action grant, no send |
| POST `/api/ops/payment-reminders/receipt` | `x-payment-workflow-secret` | Saved context plus status event/message ID; invoice identity reconstructed and actual provider message read back |

The preflight response includes `reserved:true` only when a new reminder was reserved, its opaque context, case/account/invoice IDs, fixed contact/location, approved template ID and rendered body. `authorised_send` remains false until dispatch. The first response's server-issued `workflow_run_id` follows the same invoice through both steps; the second reminder receives a different context token. The stored token is hashed, and reserved identity/expiry cannot be edited. The attempt expires after two minutes; only the final dispatch grant permits an immediate native action. A Stripe hosted invoice URL is supplied only when available and required by the approved wording. Never put protected responses or workflow secrets in browser code/public artifacts. Expiry does not permit retry or another token.

Dispatch checks the current invoice state, exact contact/DND, multiple unresolved invoices, rule/template/body hash, local hours and the unchanged case before its atomic claim. A timeout after dispatch leaves the reminder claimed. Repeating dispatch returns false, even if GHL did not receive the response. This protects against duplicate sends at the cost of requiring Eimear to reconcile an uncertain result. Native sender retries must still be disabled: the server cannot revoke a provider action already queued by GHL.

Receipt example for the new context-only path:

```json
{
  "context_token": "64-character token returned by this step's preflight",
  "workflow_run_id": "server-issued value from the first preflight",
  "event_id": "stable-native-status-event-id",
  "event_type": "reminder_sent",
  "occurred_at": "2026-11-06T09:01:00Z",
  "provider_message_id": "actualNativeMessageId"
}
```

The receipt response includes **persisted** `receipt.verified`, `receipt.state` and `receipt.sent_at`. It never advertises a fresh provider read that was not committed to the saved attempt. An identical status event may upgrade its earlier unverified outcome after a transient provider read failure; the original unknown evidence is retained. Already-verified retries remain idempotent, and reuse of one event ID for a different attempt, event type/time or message is rejected. Only a saved verified first sent/delivered receipt on a still-unpaid, unstopped case includes `followup_due_at`; use that exact timestamp for the wait. Unknown/failed/no-ID outcomes exit automatic follow-up. Receipts can still be reconciled while the send flag is off. New context-bound attempts reject the old identity-supplied callback path. An unverified candidate ID remains audit evidence and is not permanently bound as the actual message; a later genuine receipt can still be checked. A late first-reminder event cannot overwrite the second reminder's displayed outcome.

For context-bound attempts, the provider's message creation time must be **at or after the actual dispatch claim**, not merely after the earlier reservation. This comparison is strict: clock skew or rounded provider time before dispatch is held for review rather than attributed to this action. SQL enforces the same lower bound. Older unbound attempts retain the historical creation-time allowance for compatibility.

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

The initial failed-payment event does not automatically create a fully bound GHL enrollment in this code. The server context now fixes the reminder's invoice/attempt identity. Before activation, prove that GHL's saved webhook response values remain specific to the enrollment through the wait and that the native action exposes an actual message ID and supports disabled automatic retries. Do not substitute a transaction ID, contact ID or workflow ID for a native enrollment ID; no native enrollment ID is required by the server-issued path. Where response preservation or native receipt output cannot be proved, keep the workflow inactive. Signed events from both external Stripe accounts and verified contact bindings remain separate live-connection requirements.

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

The native template therefore does not need contact-level “current invoice” fields. GHL first branches on `reserved:true`, then separately calls dispatch and branches on its one-use `authorised_send:true`. Receipt mapping, native action retry/re-entry behaviour, actual template approval and a controlled end-to-end test remain required; absent a verified receipt, preserve unknown status and do not automatically send a second reminder. Eimear handles the reply through the normal conversation and payment resolution path. Invoice-specific links/components can be added later through a separately verified contract.

## Confirmed timing and final human handoff

Kevin approved this sequence in the current setup session:

1. First reminder at **09:00 Europe/London on the next working weekday after the failure**. A Friday/weekend failure rolls to Monday.
2. One follow-up **three calendar days after the provider-verified first send**, scheduled at 09:00 London and rolled forward to Monday if the due date is a weekend.
3. After the second verified sent/delivered receipt, the same unpaid case becomes **Eimear's personal follow-up**. Automatic reminders end; there is no third reminder.

Calendar arithmetic uses local dates, so daylight saving changes preserve 09:00 rather than adding fixed 24/72-hour durations. Working weekdays here mean Monday–Friday; a bank-holiday calendar is not configured. A missed schedule is held by the configured sending-hours guard; it is not permission to message overnight or at weekends. The disabled example uses the 09:00 scheduling hour (09:00–09:59) as its narrow execution window.

Follow-up timing requires a server-verified message receipt and its provider `dateAdded` timestamp, retained as `verified_sent_at`. Caller-supplied callback time and workflow progress are insufficient. Existing earlier receipts lacking that retained timestamp need actual provider reconciliation; no timestamp is invented or backfilled from an untrusted callback.

Additive migration **026** keeps already-applied 024 unchanged. It adds the verified send timestamp, a SQL London-calendar due calculator, strict first/second-only reservations, the two-attempt ceiling and explicit Eimear handoff wording/assignment. Client/scoped read tokens cannot bypass these service-only transitions. `fixtures/payments/calendar-acceptance.sql` verifies calendar/DST dates, two verified receipts, the final human task and refusal of a third reminder, then rolls back fixtures.

The confirmed timing does not activate messages: `OPS_PAYMENT_REMINDERS_ENABLED` and the example remain false. `cbb_payment_issue_v1` and `cbb_payment_followup_v1` were both observed Pending in GHL at 22:32 London on 5 November. Both are Utility, English (UK), with native Contact → First Name mapping, no footer and no buttons. Actual approved template IDs, safe native workflow mapping and receipt proof remain activation prerequisites. Neither template has been sent to a client.

## Inactive native builder recipe — 6 November 2026

The complete machine-readable example is [native-workflow-contract.json](../fixtures/payments/native-workflow-contract.json). It contains no credentials, guessed merge-field syntax or active action. Existing workflow `5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed` stays draft. All workflow inspection/configuration must use the normal GHL browser UI, not workflow APIs.

| Order | Inactive action | Exact condition/data |
| --- | --- | --- |
| 1 | Existing failed-payment trigger | Preserve re-entry/multiple-opportunity/stop-on-response settings. Prove actual external Stripe coverage separately. |
| 2 | Wait until the next working weekday at 09:00 London | Failure day is not the reminder day. Bank holidays are not configured. |
| 3 | Custom webhook: first preflight | POST the route above with trigger contact, fixed Marc location and `step_key:first`. Enable **Save response from this Webhook**. Protected secret header comes from runtime setup. |
| 4 | If/Else | Continue only on `reserved:true`. Save this response's `context_token`, server-issued `workflow_run_id`, `case_id` and expiry as per-enrollment response outputs; no contact custom fields. No native enrollment variable is required. |
| 5 | Custom webhook: dispatch | POST only the saved token/run. Continue only on this response's `authorised_send:true`. HTTP error, timeout, false or missing response exits the send path. |
| 6 | Native WhatsApp action | Exact approved first template, same contact, native Contact First Name mapping. Send immediately within expiry. Verify automatic retries are disabled. |
| 7 | Custom webhook: receipt | POST the saved token/run, stable status-event ID/time and actual native WhatsApp message ID. Never substitute transaction/conversation ID or a completed-action flag. |
| 8 | If/Else and wait | Continue only if `receipt.verified:true`, actual state `sent`/`delivered`, and `followup_due_at` is present. Wait until that exact returned date/time. Unknown/failed outcomes exit to Eimear. |
| 9 | Custom webhook: second preflight | POST to **the original saved case ID** with `step_key:second` and the original server-issued run. Never re-resolve a new invoice from the contact. Save the new token, then repeat dispatch, second approved native template and receipt. |
| 10 | End | After two verified sent/delivered reminders, the unpaid case remains with Eimear. No third reminder. Paid/reply/DND/pause stops remain active. |

At root's 6 November browser check, the Custom Webhook action supported POST, raw JSON, headers/auth and saved responses. It is a premium per-execution action; inspection did not run it. That proves configuration controls exist, not that node outputs survive a wait or that the native action returns a message ID. These account-specific points must be demonstrated before calling the sender complete. Unsupported output mapping or native retries leave the draft inactive; do not invent undocumented template parameters or a native action ID.

Root's later 6 November native template dropdown showed nine pre-existing marketing templates plus free-form; neither `cbb_payment_issue_v1` nor `cbb_payment_followup_v1` was selectable. This establishes **not selectable in the action at inspection**, not Pending/Rejected/Approved status in template settings. The unsaved WhatsApp configuration was cancelled, and the existing saved workflow remains trigger-only/draft. Template settings were not checked in that observation.

Migration028 stores only token hashes, freezes the reminder's invoice/contact/template/body/expiry, prevents reuse of the same run/step across invoices and atomically grants native dispatch once. A duplicate/lost first response, duplicate dispatch or uncertain provider outcome is deliberately held. The context receipt path reconstructs identities server-side, verifies the provider message and preserves later reminder outcomes when old callbacks arrive. The old schema2 receipt path cannot be used to bypass context checks on new attempts. No migration or code path enables the global send flag.

Verification: `npx vitest run tests/ops-payment*.test.ts`; TypeScript/scoped ESLint; and `fixtures/payments/delivery-acceptance.sql` only on the explicitly authorised isolated database after028. The SQL test exercises immutable identity, wrong context, paid/reply/multiple-invoice holds, one-use dispatch, repeated/out-of-order receipts and service-only ACLs, then rolls back all test rows. It needs a working weekday to test a successful dispatch without weakening the actual weekday guard.
