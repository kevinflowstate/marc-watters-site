# Failed payment reminders (GHL-native)

Updated 24 November 2026. Replaces the earlier preflight/dispatch/receipt design, which GHL could not satisfy because a workflow cannot see the outbound message ID.

## November 24 call decisions

Stripe creates one case per merchant and invoice and one work-list task for Eimear. The CRM workflow remains in draft and the production portal enrolment switch is off. Marc approved these UK utility templates:

| Step | Timing and wording |
|---|---|
| `cbb_payment_issue_v1` | Next working day at 09:00 London. “Hi {{1}}, it's Eimear from Construction Business Blueprint. A payment on your account hasn't gone through. Please reply here and I'll help you get it sorted.” |
| `cbb_payment_followup_v2` | 48 hours after the first reminder, if still unpaid and unanswered. “Just checking you got my message above. Give me a shout and we’ll get the details updated.” |

The second template is approved and selected in the saved draft. A live-client test remains on hold.

## Provider and portal wiring

The portal signs in each Stripe source separately, re-reads its invoice, binds the CRM contact and keeps one workflow owner per contact. A second invoice using the same contact goes to human review. Only the owning invoice can remove its enrolment. A failed or uncertain CRM operation needs reconciliation before reuse. The initial enrolment also checks the current WhatsApp DND flag.

Callbacks use the existing `POST /api/webhooks/ghl-payment` route with its secret header and a stable `event_id`. Each send result (`reminder_1_sent`, `reminder_2_sent`, `reminder_failed`, `escalated`) requires the `contact_id`, original `invoice_id` and `stripe_account_id` from that particular workflow run. Use the immutable values from enrolment. A lookup of the most recently unpaid invoice or mutable contact fields can misattribute a late callback. The response rejects unscoped delivery callbacks. A signed send report is distinct from an independently verified delivery receipt.

Contact-wide `reply_received` and `dnd` callbacks use `contact_id` and `event_id`; every open case for that contact stops for Eimear. A failed WhatsApp pauses the matching invoice, records a manual task and stops the owned workflow. Replayed outcomes and late callbacks after settlement cannot advance the invoice. A card change alone is not settlement.

**Before activation:** the current native workflow still needs an immutable invoice and merchant mapping for its callbacks, a failed-send branch and pre-send eligibility verification. Keep all three workflows in Draft while these are outstanding. Use isolated fixtures for failure, second invoice, reply, opt-out and settlement. Marc must authorise any later live-client WhatsApp test.

## (c) Environment variables

| Variable | Purpose |
|---|---|
| `OPS_PAYMENT_REMINDERS_ENABLED` | `true` to enrol new unpaid cases. Anything else: case and task only, recorded as "reminders off". |
| `OPS_PAYMENT_WORKFLOW_ID` | `5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed` |
| `CBB_GHL_PIT_TOKEN` | Private Integration token for Marc's location. Needs `contacts.readonly` and `contacts.write` (search, add/remove workflow). Shared with content scheduling. |
| `OPS_PAYMENT_WORKFLOW_SECRET` | Shared secret GHL sends in `x-payment-workflow-secret`. |
| `OPS_STRIPE_PAYMENT_ACCOUNTS_JSON` | Per-account Stripe config: `{ "alias": { "account_id", "api_key", "webhook_secret", "livemode", "label" } }`. `label` (optional) is the account name shown to Eimear. |

Removed: `OPS_LEGACY_PAYMENT_EVENTS_ENABLED`, `OPS_GHL_PAYMENT_TOKEN`, `OPS_PAYMENT_RULES_JSON`.

GHL endpoints used (base `https://services.leadconnectorhq.com`, header `Version: 2021-07-28`): `POST /contacts/search` (email `eq` filter), `POST /contacts/{contactId}/workflow/{workflowId}` (body `eventStartTime`), `DELETE /contacts/{contactId}/workflow/{workflowId}` (404 = already out), `GET /contacts/{contactId}` (manual binding check).

## Timing and recovery

Bank holidays use the existing weekday rule. Cases opened while reminders were off are not enrolled retroactively. If a workflow owner becomes uncertain after an interrupted provider request, reconcile that invoice with CRM enrolment history before clearing its owner or retrying.
