# CBB operating model — 5 November 2026

This supersedes the AI/Canva/hosted video assumptions in the 31 October foundation plan. All ten business workflows remain in scope; simplifying where preparation happens does not remove workflows.

| Work                                        | Codex and connected services                                                                                          | Portal                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared business knowledge                   | Read current Marc-owned Drive documents; use repo skills/scripts.                                                     | Links to the relevant source beside work that needs attention.                                                                                                          |
| Content                                     | Prepare copy/media in a versioned Drive pack; Marc/Eimear review in their normal tool.                                | Show review status. A specific scheduling action must verify the approved version, schedule through Marc’s CRM and save each provider result.                           |
| Lessons                                     | Obtain source from Fathom, edit in Codex, store a private preview in Drive, collect exact-version human approval.     | Show progress/review links. Add the approved lesson to Training through an authenticated publication action and record the result. No embedded editing studio required. |
| Payments/onboarding/check-ins               | Provider events and fixed business rules update records; Codex summarises exceptions or prepares wording when useful. | Show named tasks/alerts for Marc or Eimear and completion evidence.                                                                                                     |
| Inbox/diary/renewals, money records, events | Connected tools gather facts; Codex prepares drafts/checklists. Agreed deterministic actions need their own handlers. | Show required decisions, links and action results.                                                                                                                      |
| Thursday reporting                          | Portal gathers traceable figures; Codex reads them and submits prepared wording.                                      | Preserve edits, review the exact saved revision, send only through the separately configured action, retain the receipt.                                                |

## Implemented in this revision

- Work is split into Marc’s Tasks and Eimear’s Tasks, with a separate Flowstate/automation queue. Every queue shows actual saved status, not a claim that an agent is running.
- Approving is distinct from finishing. Approved work remains current until completion is recorded; pending approvals cannot be marked done from the workspace UI.
- The new Ops report and cut-proposal paths do not call an AI provider. No `ANTHROPIC_API_KEY` is required for these paths. Existing pre-PR Blueprint AI features are separate and were not removed.
- Report data gathering preserves narrative text and observations. Codex reads the data/revision and submits narrative through authenticated REST/MCP. The submission cannot approve/send or silently replace human edits/reviewed work.
- Superseded in-portal editing/hosted rendering is hidden and disabled by default. Its optional legacy implementation is retained behind an explicit server setting. Canva scaffolding is historical, not a delivery dependency.

## Not yet live or complete

- This branch is a non-live draft. Production SQL, deployment, live credentials and Marc-account installation have not been performed.
- The generic authenticated task interface can accept Codex outputs, links and approval requests. Its bearer token is currently a broad trusted-admin credential, not a per-action credential; do not expose it to a browser or automatically grant it to another account. Production scoping/installation needs review.
- External Codex/Drive approval must become an authenticated record identifying approver, artifact version/hash, destination and allowed action. “Approved” in chat or a folder name alone does not unlock production execution. Generic task approval also does not yet launch a provider action.
- “Schedule this week’s content” still needs the versioned pack reader, exact approval check, Marc-account scheduling adapter, duplicate prevention, partial-failure recovery and per-post receipts. The old Social Planner scaffold is deliberately Flowstate-test-only.
- Approved Drive lesson → portal Training publication still needs its authenticated adapter, durable playable media destination and exact-version approval/receipt checks. A private Drive share URL is not automatically a streamable training URL.
- Content changes must invalidate approval; a failed/uncertain provider action must not be shown as completed or blindly retried. Existing task proposal revision handling and report send claims are useful foundations, not proof of the new production actions.
- Cloud scheduled Codex work, provider webhooks and portal buttons are separate execution paths. Verify actual trigger/tool support, agreed times and end-to-end receipts; a task row does not start Codex by itself. No new paid model fallback or claim of unlimited free unattended runs.

## Next build order

1. Verify the revised workspace and Codex report handoff against non-live fixtures.
2. Implement the versioned content-pack/approval/action contract and scoped integration. Prove dry-run, duplicate click and partial failure behaviour before any live post.
3. Implement the approved lesson publication handoff using the real lesson result from Marc’s Codex.
4. Connect payment/provider events and confirmed business rules, then production acceptance and rollout.

Keep Marc’s active knowledge setup work in `cbb-ops-knowledge` separate from these portal changes. Do not modify its branches or environment configuration from this portal task.
