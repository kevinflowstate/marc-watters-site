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
