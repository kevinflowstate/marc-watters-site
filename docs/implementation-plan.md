# CBB implementation plan — 5 November 2026

## What Marc and Eimear will see

The portal is their workspace. Codex prepares drafts and edited files. Drive holds the source material. The CRM sends agreed client messages; provider events and authenticated portal actions update the visible status. A saved task is not proof that a message was delivered or an action completed.

## Payment journey

1. Stripe reports a failed payment. Identify the merchant account and invoice, verify its current status and match it to the correct client. Ambiguous matches become an Eimear task.
2. Show one current payment case in the portal, with the amount, client, source and next action. Duplicate events do not create duplicate work.
3. GHL checks the case immediately before each agreed reminder. Only an enabled rule, a still-unpaid invoice, an eligible WhatsApp recipient and the exact approved template can proceed. The attempt gets a stable reference.
4. Record requested, accepted, delivered and failed messaging outcomes separately. Failure or an unknown outcome stays visible for reconciliation; it is not a successful reminder.
5. A successful payment closes only the matching invoice case. Pause/cancellation, a reply needing a person or DND stops automated reminders. Eimear receives the useful next action.
6. A confirmed escalation rule creates human follow-up after the agreed reminder sequence. No timing/count is silently adopted from an old seed document.

Existing native workflows, Stripe retry/email behaviour and WhatsApp templates must be inspected before installing anything. Build new flows inactive and preserve existing live workflows. Never enrol real clients or send a message merely to test configuration.

## Approved payment timing and first release

Kevin confirmed in this chat: first reminder next working day, one follow-up three days later, then Eimear. The implementation uses 09:00 Europe/London; weekends roll forward to Monday. This means weekdays, not a bank-holiday calendar. The follow-up is anchored to the verified first message time. Two messages is the maximum, and any reply, payment, DND, pause or uncertain send stops automated progression.

The first message intentionally asks the client to reply. It does not insert a potentially incorrect invoice/payment link. The server still verifies the exact unpaid invoice and contact. More than one unresolved invoice for the same contact is held for a person.

Submitted to Meta on 5 November: `cbb_payment_issue_v1`, English (UK), Utility, one variable mapped through GHL's Contact → First Name picker, no footer/buttons. Current observed status: **Pending**, not approved or sent.

> Hi {{first_name}}, it's Eimear from Construction Business Blueprint. A payment on your account hasn't gone through. Please reply here and I'll help you get it sorted.

The follow-up template `cbb_payment_followup_v1` was also submitted as English (UK), Utility, with the same first-name mapping. Both templates were observed **Pending** at 22:32 London on 5 November. Its copy is: “Hi {{first_name}}, it's Eimear from Construction Business Blueprint. The payment we contacted you about is still showing as unpaid. Please reply here if you need help getting it sorted.”

## Actual GHL state

Verified in the normal browser at `app.flow-state.tech`, location MRW Management LTD / `93GJEdsr0cT9el3OINXq`:

- Existing Payment Workflows folder contains the 6-month and 12-month payment-success/access/contract flows and Meta CAPI Payment Converted. All three are published and were not changed. Searching workflow names for “payment” found these and the folder; that is not an exhaustive audit of every differently named workflow.
- WhatsApp account Approved, Meta business Verified; sender 07411 235027 Connected and quality Green. The action's mapped-template selector offered marketing templates. Searching the full template inventory for “payment” returned none before this task created the new template.
- Created **inactive trigger draft** `5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed`: “CBB Ops | Payment recovery | DRAFT - awaiting activation”, Payment Received filtered Payment Status Is Failed. Re-entry/multiple-opportunity entry off, stop-on-response on. Reopened and confirmed Saved/Draft. No sending action or live enrollment exists yet.
- This draft is not a complete reminder runner. It still needs the deployed authenticated preflight, approved templates, per-run case/attempt retention, receipt callbacks, reply/DND handoff and controlled acceptance. GHL's invoice-trigger re-entry exception means the portal reservation remains necessary even with re-entry disabled.
- Contact-based first-step preflight: `POST /api/ops/payment-reminders/preflight`, dedicated workflow secret, exact location/contact and step key. It selects only one already bound unpaid case and reserves at most one permitted reminder. It does not send.

Direct Stripe events from both accounts remain authoritative. Do not assume that the native GHL payment trigger sees all payments made directly in Stripe.

## Parallel build ownership

| Stream | Owner | Deliverable | Acceptance |
| --- | --- | --- | --- |
| Approvals and scoped access | cbb_approval_core | Immutable submitted versions, authenticated decisions, atomic item claims and receipts, limited integration tokens | Stale/forged decisions rejected; duplicate claims safe; unknown actions held |
| Content | cbb_content_schedule | Validated weekly pack and one-post CRM scheduling adapter | Exact destinations/dates/media; dry-run; wrong account and uncertain result handled |
| Lessons | cbb_lesson_publish | Trusted private media verification and approved Training handoff | Exact bytes/version; draft visibility; safe destination; idempotent publication receipt |
| Payments | cbb_payment_workflows | Invoice/account case ledger, signed intake, reminder preflight and WhatsApp outcomes | Invoice independence, duplicate/out-of-order events, reply/DND/paid stops |
| GHL discovery | cbb_ghl_audit | Read-only channel/template evidence and current official integration semantics | Existing identity and supported capabilities distinguished from assumptions |
| Integration and UI | parent chat | Portal action/review screens, GHL browser inspection/drafts, assembled tests and delivery handover | Populated non-live desktop/mobile journeys and actual saved statuses |

All code agents share the existing foundation worktree with disjoint file ownership. Parent owns integration and commits. No agent may merge/deploy production, send messages, register live Stripe hooks or change business-account state as a test.

## Content and lessons

Content: Codex prepares a versioned Drive pack → import/validate → authenticated human approves exact version → Schedule This Week's Content → one recorded result per post. Changed copy/media/time/account requires a new decision. A timeout is investigated before another create attempt.

Lessons: Codex edits → privately stores verified finished video/workbook → human approves exact version and destination → add draft or publish to Training → save actual lesson/module receipt. A private Drive link is not assumed to be a playable training asset. Fathom download availability is a separate source-access issue.

## Existing work to complete and retain

Keep the split Marc/Eimear workspace and report-text handoff. Apply limited Codex permissions to the required draft interfaces. Check existing onboarding/engagement rules before enabling timers. Use actual last-run/result information; never present a prepared job as running. Test the available private cloud jobs separately from provider messaging and portal deployment.

## Release sequence

Build and test against synthetic/non-live data → integrate and review the complete branch → verify inactive GHL configuration where the logged-in UI permits → show a usable preview and concrete messages/rules → activate only the agreed live account/rules/actions after real-account acceptance. Production release and client sends are distinct from completing the build.

Current base: portal PR32, codex/cbb-ops-foundation at cc5150207f8d0f183bf0f58b883b1792a6f258ee. Knowledge PR1 and Marc's cloud configuration remain separate; do not merge the pending knowledge PR as a side effect.

## Verified build checkpoint

Migrations 023–026 applied only to the authorised non-live database `abmmlybdqwzujcysagvf`. Calendar/DST, invoice isolation, duplicate events, receipt verification and final Eimear handoff SQL checks passed with fixtures rolled back. Six concurrent execution/item claims produced one actual item claim.

The authenticated portal was exercised with labelled demo fixtures: content approval persists, rejected lesson feedback persists, private synthetic MP4 playback works, sending controls remain off, and Marc/Eimear task columns remain. Desktop and narrow mobile layouts were checked. No production database changes, client messages, real social posts or real lesson publication occurred.

Before live activation: deploy the reviewed portal branch; configure both signed Stripe sources; confirm contact consent/bindings; obtain approved template IDs; demonstrate the native GHL per-run context, single send and actual message-ID receipt callback with a permitted test contact. Only then enable the agreed workflow. The native draft currently contains the failed-payment trigger/settings, not the complete reminder sequence.
