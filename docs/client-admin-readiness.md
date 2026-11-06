# Client and admin workflow readiness

Checkpoint: 6 November 2026. These checks use synthetic fixtures and mocked delivery. They do not send a reply, issue a real invitation, enable an automation or change production.

## Behaviour verified

| Situation | What the workspace does |
| --- | --- |
| A client message has been opened but unanswered | Keeps a reply item visible. Reading is not replying. |
| The team answers, then the client writes again | Clears the answered item and reopens it for the newer client message. |
| The order or date of messages/check-in replies is uncertain | Asks for a check instead of declaring the conversation answered. |
| More than one concern exists for a client | Shows one stable card for Eimear, retaining the distinct reasons. |
| A client is archived | Excludes the client from the active read/workspace signals. |
| Portal records say payment collection is paused/cancelled | Suppresses routine activity/check-in gap prompts. Their unanswered questions remain visible. |
| An old activity/check-in date reaches 14 days | Presents it as a review threshold; asks the team to check the client's expected schedule before contacting them. |
| A source cannot be read | Marks the check incomplete. It does not report zero issues or claim inactivity from missing sources. |
| Training or lesson progress is recorded | Uses dated recorded activity. It does not claim video watch time, understanding or completion of lessons without completion records. |
| A task has changes requested | Keeps it current and needing attention. Approval and completion remain separate states. |
| An inbox/renewal task is assigned to Marc/Eimear | Preserves that owner and its state until an explicit task update. No email or calendar action follows from the card alone. |
| Successful onboarding intake is repeated | Reuses the existing account path and retries the checklist without another invitation or welcome call. |
| An existing intake account has no ready profile | Returns a retry-needed response rather than creating another invitation/account. |

The pause/cancellation check uses the existing `client_profiles.payment_status` signal. It is a conservative hold on routine prompts, not a new membership-status model or permission to stop answering a client. The read API exposes only the derived routine-follow-up hold.

## What still needs a real business decision or trial

| Workflow | Implemented/tested preparation | Needed before operational use |
| --- | --- | --- |
| Client messages and check-ins | Scoped client reads, latest-sender/reply checks, stable Eimear task grouping, partial-data warnings | Confirm which questions Marc handles versus Eimear, expected response/check-in arrangements, and verify the real portal connection/team trial. |
| New-client onboarding | Existing checklist/intake code; successful/outage retries do not repeat the mocked welcome or invitation | Confirm which offer/payment admits the client, required forms/access/welcome destinations and when a person must take over. Verify one permitted real-account flow separately. |
| Inbox, diary and renewals | Existing task states/owners and saved private brief; fixture checks keep approved work current until completed | Confirm the intended mailboxes/calendar, booking/renewal rules and who may send or book. A task is not evidence that an email was sent or a booking made. |
| Receipts/payment matching | Instructions and money-review workflow exist | Confirm the accountant/Hubdoc destination and access to the actual ledger, then match one real receipt without moving money or marking an unsupported match complete. |
| Events/outreach | Event preparation instructions and task destination exist | Supply the current event date, offer, audience and delivery channels, then review a dated plan. No generic event details should be invented. |
| Eimear's daily use | Split task lists and authenticated preview work | Verify Eimear's own Drive/portal/Codex access, real working-day journeys and mobile use. |

## Evidence and limits

Run the focused checks with:

```sh
npx vitest run tests/ops-workspace-feed.test.ts tests/ops-workspace.test.ts tests/ops-portal-monitor.test.ts tests/ops-new-client-recovery.test.ts tests/ops-workspace-integration.test.ts
```

At this checkpoint all 55 tests pass. They cover read scopes, client isolation/pagination, archived/paused handling, reply ordering, state/owner mapping, source failures and replayed intake. Invitation/welcome providers are mocked; the repeated-intake result is code-level acceptance, not evidence of actual email delivery or the separate concurrent provider behaviour.

The five CBB scheduled jobs remain paused. Sending, scheduling, publication and production release are outside these fixture checks.

## Internal onboarding handoff — 6 November completion sprint

The authenticated new-client webhook now honours `FLOWSTATE_PORTAL_SEND_ENABLED`. Unless it is exactly `true`, a new client intake saves a deduplicated access-review task for Eimear before account creation, so no Auth/profile trigger, module grant, activation invitation, welcome email or client welcome notification occurs. An already provisioned client receives the internal checklist without new delivery. It does not mark an invitation as sent or advance the onboarding stage. The internal tasks are **Review the new client’s access**, **Add the client to the community**, and **Send the client’s welcome pack**. Their wording explains the required human decision; completing a task does not deliver anything automatically.

Stable client/step references reuse the existing community/welcome task identities. Replayed intake preserves completed tasks and human edits; completed onboarding creates no new work, and archived clients cannot start this preparation. Existing tasks retain their current owner/decisions rather than being silently reassigned. No new response deadline is invented when the profile has no agreed onboarding due date.

An unavailable account lookup now returns a retry-needed503 before any account creation, avoiding a fall-through that could attempt a duplicate account. Invalid JSON and incorrectly typed client input return400. Raw intake bodies are no longer logged.

With sending off, unknown clients remain pending human admission and have no portal account. Existing clients retain their existing access. The explicitly enabled legacy path still provisions accounts and assigns modules through its existing triggers, so the admitting offer/payment rules must be confirmed before enabling that path or connecting a live trigger. No live trigger, client or provider was exercised in this sprint.

Focused validation:40tests across ops-new-client-recovery, ops-onboarding-checklist, ops-portal-monitor and ops-workspace-feed pass. A stateful persistence-boundary fixture proves task reuse, retained human completion and correct Eimear assignment. The read-route fixture follows unanswered→opened→admin reply→new client response→source outage→recovery across independent reads, including a paused membership. Database/provider boundaries remain test doubles; this is not a hosted/database acceptance pass.

Root acceptance before rollout: deploy the reviewed intake/read routes and existing task RPCs to the intended environment with all switches off; run the dedicated synthetic journey; verify tasks and source reads in the current workspace; then verify Eimear’s own access. Live client correspondence, real invitation delivery and production coverage remain unverified.

Outstanding business decisions for this lane are limited to: (1) which confirmed offer/payment authorises account admission; (2) the correct community and welcome pack plus who approves access; (3) who handles which client questions and the expected check-in/reply arrangements. Existing rules are not guessed from a generic14-day review prompt.

## Hosted intake rehearsal and replay correction — delivery sprint

Inspection of the actual task RPC found that its ordinary create/replay path updates machine title/detail/payload on an existing task. The earlier stateful mock preserved these fields and therefore did not prove protection of human edits in the database. Onboarding preparation now uses the dedicated service-only `ops_create_onboarding_task(p_data jsonb)` contract from additive migration030. It returns an existing task unchanged under the same external-reference lock and audits only genuinely new preparation. A missing/unavailable preparation store returns a retryable503 while access and sending remain paused.

Root must apply030 only to the authorised preview and run `fixtures/onboarding/acceptance.sql`; the script rolls back its synthetic task/audit changes. The separate hosted verifier `cbb-ops-build/verify-intake-deployed.cjs` requires the existing branch-preview webhook secret via an owner-only file. Vercel CLI metadata confirmed that Preview/codex/cbb-ops-foundation already has this credential; no production credential or newly enabled trigger is needed.

The hosted rehearsal uses one random example.invalid address, checks the destination identity and all seven switches, denies a wrong secret and malformed inputs, submits simultaneous first requests, retains one Eimear review task, saves a synthetic human completion and verifies that a later intake preserves it. It checks preview Auth and database state for zero accounts/profiles/module assignments/invites/client notifications, then removes only its own synthetic task and cascading audit rows. Run without concurrent fixture writes because unchanged module/notification totals are part of the assertion. This rehearsal does not send an email or activate an account. SQL/hosted results are recorded by root after execution; preparation alone is not a hosted pass.
