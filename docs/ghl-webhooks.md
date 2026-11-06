# Current payment workflow — 5 November 2026

The invoice-scoped implementation and disabled-by-default CRM reminder contract are in [payment workflows](payment-workflows.md). Stripe-signed current invoice reads are the payment authority; CRM events report reminders/replies/DND and cannot assert settlement. Each account/invoice has its own case/task, and duplicate preflights cannot grant another send. No client messages were sent by this build.

The current native reminder contract uses a server-issued first handoff ID and a per-step opaque context token. First preflight reserves only (`reserved:true`, `authorised_send:false`); `/api/ops/payment-reminders/dispatch` grants the native action once after fresh checks. `/api/ops/payment-reminders/receipt` accepts saved context plus the actual message ID, reconstructs invoice identity and verifies provider delivery. It remains available while sending is paused. Carry saved webhook outputs inside the enrollment; never use contact-level current-invoice fields. The exact inactive builder recipe and remaining account-specific output/receipt checks are in [payment workflows](payment-workflows.md#inactive-native-builder-recipe--6-november-2026).

The earlier email/global-state webhook below is retained only for compatibility testing behind `OPS_LEGACY_PAYMENT_EVENTS_ENABLED=true`. It is off by default and must not be used as the production payment authority. New-client onboarding/daily signal work below is historical foundation context; timing thresholds still need confirmation.

---

## Historical foundation contract

# CRM payment and onboarding handoff — DRAFT

**NEEDS KEVIN:** Build the workflows in Marc’s live sub-account and confirm the exact trigger names visible there. This build does not write to Marc’s CRM, register workflows or send messages.

POST `/api/webhooks/ghl-payment` with `x-webhook-secret: OPS_WEBHOOK_SECRET` and JSON:

```json
{
  "event_type": "payment_failed",
  "contact_email": "person@example.com",
  "contact_id": "crm-contact-id",
  "external_id": "stable-unique-payment-event-id",
  "amount": 100.0,
  "currency": "GBP",
  "occurred_at": "2026-10-31T12:00:00Z"
}
```

Map a stable unique event ID, not a new random value per delivery. `amount` uses major units and is converted to integer pence. Timestamp is the event time (ISO 8601). Supported types: `payment_failed`, `chase_sent`, `payment_succeeded`, `subscription_cancelled`, `payment_paused`. External IDs are unique; repeat delivery is a no-op in one database transaction. Older events remain in the ledger but cannot regress current payment state. Email matching is case-insensitive and must identify exactly one portal client; unknown/ambiguous matches create a human flag. Contact ID is context, not matching authority.

Suggested workflow intents (exact native trigger names unverified): failed payment → payment_failed; successful reminder action → chase_sent; payment received → payment_succeeded; cancellation → subscription_cancelled; paused subscription → payment_paused. A second reminder creates a resolution task; a success resets the counter and closes open payment tasks. No automated chasing is sent by the portal.

The existing new-client webhook starts invited onboarding with a 48-hour due date and two checklist tasks (community admission, welcome pack). It retains the existing welcome/invite behaviour; do not replay it against real clients for acceptance. Operator tooling advances `/api/ops/clients/{id}/onboarding` with `{ "stage": "community_added" }` etc. Stage progression is monotonic and closes the corresponding checklist items. Manual payment/next-action controls live on the admin client page.

Daily cron is read-and-flag only: overdue onboarding, chasing for >7 days, no check-in for 14 days (one open engagement task), late lessons, Monday payment review. Cron and Thursday schedules are added by Stream G. All fixtures use `.invalid` synthetic identities, never Marc’s CRM.

Events with identical occurred_at use fixed precedence: subscription_cancelled, payment_paused, payment_succeeded, chase_sent, payment_failed (highest first). This preserves a cancelled/paused account while allowing a successful payment to settle a same-time reminder regardless of delivery order. Last-payment metadata and reminder-cycle counts still come from the ledger. Identical event IDs remain no-ops.

A successful payment tied with cancellation/pause still settles existing payment follow-up work. Settlement uses chronological freshness independently of status precedence; an older payment cannot close a later unpaid cycle’s work.
