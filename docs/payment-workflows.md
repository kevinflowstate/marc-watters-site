# Failed payment reminders (GHL-native)

Updated 7 November 2026. Replaces the earlier preflight/dispatch/receipt design, which GHL could not satisfy because a workflow cannot see the outbound message ID.

## (a) The flow

1. Stripe sends `invoice.payment_failed` (and paid, voided and subscription events) for each MRW Management Ltd account to `/api/webhooks/stripe-ops/{account-alias}`, where the portal checks the signature, re-reads the invoice from Stripe, records one case per account + invoice and opens a task for Eimear.
2. On a new unpaid case, if `OPS_PAYMENT_REMINDERS_ENABLED=true`, the portal finds the CRM contact by the invoice email in Marc's location and adds them to reminder workflow `5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed`, passing reminder 1's time as the workflow event start time; if no contact or more than one matches, nobody is enrolled and Eimear's task says so.
3. GHL sends reminder 1 at 09:00 London on the next working day (Mon-Fri) after the failure, then reminder 2 exactly 48 hours later if the invoice is still unpaid, and reports each step back to `/api/webhooks/ghl-payment`.
4. When Stripe reports the invoice paid or voided, the portal closes that case's task (Eimear's note is kept) and removes the contact from the workflow.
5. A reply, a DND or the end of the workflow ("escalated") marks the case as needing Eimear, and her task is reopened with the detail.

## (b) GHL workflow build spec

Workflow `5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed` ("CBB Ops | Payment recovery"). Build it in the GHL builder by hand. Leave it in Draft until the test in section (d) passes.

**Settings (gear icon)**
- Allow re-entry: **off**.
- Stop on response: **on** (a client reply ends the workflow; the reply webhook in step 6 still tells the portal).
- Time zone: Europe/London (account time zone).

**Trigger - pick one**
- **Option A (recommended): portal enrolment.** The portal adds contacts through the API, which works with any trigger. Remove the existing "Payment Received - Payment Status is Failed" trigger, or leave the workflow with no trigger, so contacts are not enrolled twice.
- **Option B: GHL's native Payment Failed trigger**, only if Marc's invoices are billed through GHL payments rather than directly in Stripe. Then set `OPS_PAYMENT_REMINDERS_ENABLED=false` so the portal does not also enrol. Limitation: the portal only links GHL callbacks to a case once a contact ID is on it, so Eimear must match the contact on the case.

**Steps**
1. **Wait** - "Wait until event start date/time", 0 minutes after. The portal sets the event start time to 09:00 London on the next working day after the failure.
   - If that wait type does not appear for this trigger, use: Wait 1 day, then Advanced window Mon-Fri 09:00-09:30. Caveat: an afternoon failure then waits an extra day. Kevin decides.
2. **WhatsApp** - template `cbb_payment_issue_v1`.
3. **Custom Webhook** (reminder 1 reported) - see the bodies below, `event_type` `reminder_1_sent`.
4. **Wait** - Time delay 48 hours.
   - **Decision for Kevin:** 48 hours after a Friday 09:00 reminder 1 is **Sunday 09:00**. Either accept it, or add an Advanced window Mon-Fri 09:00-09:30 to this wait so it moves to Monday. The portal currently shows exactly 48 hours.
5. **WhatsApp** - template `cbb_payment_followup_v1`.
6. **Custom Webhook** - `event_type` `reminder_2_sent`.
7. **Custom Webhook** - `event_type` `escalated` (both reminders sent, still unpaid; the portal reopens Eimear's task).
8. End.

**Reply and DND.** Add a separate small workflow (or an If/Else branch in a "Customer Replied" workflow) for contacts in this workflow: on a WhatsApp reply, Custom Webhook `reply_received`; when DND is switched on, Custom Webhook `dnd`.

**Payment received.** If the account has a native Payment Received trigger, add a workflow that removes the contact from this workflow ("Remove from workflow" action). The portal does this as well from Stripe; the duplicate is harmless.

**Custom Webhook action settings (every step)**
- Method: `POST`
- URL: `https://marc-watters-site.vercel.app/api/webhooks/ghl-payment` (use the live portal domain if it is different)
- Header: `x-payment-workflow-secret` = the value of `OPS_PAYMENT_WORKFLOW_SECRET`
- Header: `Content-Type` = `application/json`
- Body (change only `event_type` and the suffix of `event_id`):

```json
{
  "event_type": "reminder_1_sent",
  "contact_id": "{{contact.id}}",
  "event_id": "{{contact.id}}-reminder_1_sent"
}
```

```json
{
  "event_type": "reminder_2_sent",
  "contact_id": "{{contact.id}}",
  "event_id": "{{contact.id}}-reminder_2_sent"
}
```

```json
{
  "event_type": "escalated",
  "contact_id": "{{contact.id}}",
  "event_id": "{{contact.id}}-escalated"
}
```

```json
{
  "event_type": "reply_received",
  "contact_id": "{{contact.id}}",
  "event_id": "{{contact.id}}-reply-{{message.id}}"
}
```

```json
{
  "event_type": "dnd",
  "contact_id": "{{contact.id}}",
  "event_id": "{{contact.id}}-dnd"
}
```

Optional fields: `occurred_at` (ISO time; the portal uses the time it receives the call if left out) and `invoice_id` (Stripe `in_...`, narrows the update to one invoice). If `{{message.id}}` is not offered in the reply workflow, use `{{contact.id}}-reply`.

How the portal treats them: duplicate `event_id`s for the same case are ignored; the update applies to the contact's open cases (all of them if there are several, and the task notes it); `escalated`, `reply_received` and `dnd` reopen Eimear's task; `reply_received` and `dnd` mark the case "needs a person". Unknown contacts return `matched: 0` without error.

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

## (d) Still manual

- Building the workflow above in the GHL builder, choosing the trigger option and the Sunday decision, and publishing it.
- Meta approval of templates `cbb_payment_issue_v1` and `cbb_payment_followup_v1`.
- Setting the env vars in Vercel and registering both Stripe webhook endpoints.
- First live test: a test invoice on one Stripe account that fails, check the case, enrolment, both webhooks and removal on payment.
- Cases with no single CRM match: Eimear matches the contact in the CRM and adds them to the workflow by hand (the admin binding route records the contact on the case so later callbacks attach).
- Bank holidays are not handled.
- Cases opened while reminders were off are not enrolled retroactively.
