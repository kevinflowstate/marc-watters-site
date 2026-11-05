<!-- Current behaviour documented on 5 November 2026; prior acceptance evidence is historical. -->

# CBB Operations API

Current direction: **Codex prepares; Drive stores files; the portal tracks work, human decisions and execution receipts.** See [current operating model](codex-operating-model.md). Draft PR stays unmerged; production integration remains pending.

All `/api/ops/*` and `/api/mcp` requests require `Authorization: Bearer <OPS_API_TOKEN>`. The token is compared by constant-time SHA-256 digest equality. An in-process limit of 120 authenticated requests/minute applies across these endpoints per instance; use a shared external limiter before scaling to multiple instances. Missing/invalid tokens return 401, exhausted limits 429. Admin `/api/admin/work` uses the existing signed-in admin check. Secrets are never browser variables. Outputs must be HTTP(S) or portal-relative URLs.

| Endpoint                           | Methods     | Behaviour                                                                     |
| ---------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `/api/ops/tasks`                   | GET, POST   | Filter status/area/assignee/clientId; create or upsert external_ref           |
| `/api/ops/tasks/{id}`              | PATCH, POST | Update fields; record a decision or attach an output                          |
| `/api/ops/clients`                 | GET         | Client signals and user summary                                               |
| `/api/ops/clients/{id}`            | GET         | One client                                                                    |
| `/api/ops/clients/{id}/onboarding` | POST        | Advance onboarding                                                            |
| `/api/ops/lessons`                 | GET         | Recording queue                                                               |
| `/api/ops/lessons/{id}`            | GET, POST   | Read; editing actions require explicit legacy mode                            |
| `/api/ops/render-jobs/{id}`        | PATCH       | Existing worker progress/output callback                                      |
| `/api/ops/reports`                 | GET, POST   | List; gather current weekly figures without AI generation                     |
| `/api/ops/reports/{id}`            | GET, PATCH  | Read figures/revision; submit Codex-prepared narrative as an unapproved draft |
| `/api/mcp`                         | POST        | Stateless Streamable HTTP; authenticated GET/DELETE may return 405            |

```sh
curl "$PORTAL/api/ops/tasks?area=content" -H "Authorization: Bearer $OPS_API_TOKEN"
curl "$PORTAL/api/ops/tasks" -H "Authorization: Bearer $OPS_API_TOKEN" -H 'Content-Type: application/json' --data '{"kind":"approval","title":"Review caption","area":"content","external_ref":"content:example:1"}'
```

MCP tools: `create_task`, `list_tasks`, `update_task`, `request_approval`, `attach_output`, `get_client`, `list_clients_needing_attention`, `get_lesson`, `list_lessons`, `propose_lesson_cuts`, `create_report_draft`, `get_report`, `submit_report_draft`. `update_client_onboarding` is added in Stream D. Each has a JSON schema and a plain-language description. Codex-generated outputs go to human approval; these tools do not publish content or send client messages. `propose_lesson_cuts` is optional legacy mode only and requires `OPS_LEGACY_LESSON_PIPELINE_ENABLED=true` plus a supplied `cuts` array; it no longer generates cuts using an AI API. `create_report_draft` gathers figures only. Read them using `get_report`, then call `submit_report_draft` with `id`, `expected_updated_at` and `narrative_md`. This rejects stale revisions, reviewed/sending reports and existing human edits; it never grants review or send approval.

The Next 16 build accepts `mcp-handler` 2.x with the official SDK dependencies. It creates a fresh server per request and supports current and 2025 stateless Streamable HTTP clients; no Redis/session state. No legacy SSE URL.

## Connector configuration

In a Claude Team custom connector, use the complete deployed preview `/api/mcp` URL and a dedicated bearer token if the UI supports custom authorization headers. If the account UI only accepts OAuth, this token-only foundation cannot be installed directly: use an approved bearer-capable bridge or implement OAuth as a separate reviewed change. No organisation/seat purchase or connector registration is performed here.

Codex `config.toml`:

```toml
[mcp_servers.cbb_ops]
url = "https://YOUR-PREVIEW/api/mcp"
bearer_token_env_var = "CBB_OPS_TOKEN"
```

Keep `CBB_OPS_TOKEN` in the local secure environment, matching the server’s `OPS_API_TOKEN`. Do not commit it. Restrict access to trusted operators: this is an admin token with access to all CBB client records.

## Server configuration

All values pass through `lib/env.ts` normalisation (`.trim()` plus pasted literal newline cleanup): `OPS_API_TOKEN`, `OPS_WEBHOOK_SECRET`, `FATHOM_API_KEY`, `FATHOM_WEBHOOK_SECRET`, `RENDER_HOST_URL`, `RENDER_HOST_SECRET`, optional `GHL_LOCATION_TOKEN`, `OPS_LEGACY_LESSON_PIPELINE_ENABLED` (default false), `OPS_REPORT_SEND_ENABLED` (default false), `OPS_NOTIFICATIONS_ENABLED` (default false). The new Ops flow no longer requires an AI-provider key. Existing unrelated Blueprint AI functionality retains its own configuration. `CRON_SECRET`, `WEBHOOK_SECRET` and `RESEND_API_KEY` remain server-only. Existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` identify only the permitted non-live project for these branches; service-role keys are never public. Do not reuse production webhook/cron secrets in previews.

Non-live database: `abmmlybdqwzujcysagvf`. Production `eeatjpbwwkgytznkfdww` is forbidden for this build. New migrations are additive numbered 019–022; apply only to non-live/local. Scripts refuse production targets. The old non-live database predates some portal columns; record any baseline compatibility requirements separately.

## Verification

`OPS_TEST_ACCOUNT=/private/test-account.json node --env-file=.env.local scripts/ops-admin-smoke.mjs` exercises admin work API against port 3087.

`node --env-file=.env.local scripts/ops-smoke.mjs` checks all REST routes and every tool through the official MCP SDK client. The historical full-domain test needs a disposable demo client/recording/render job via `OPS_SMOKE_CLIENT_ID`, `OPS_SMOKE_LESSON_ID`, `OPS_SMOKE_JOB_ID`; use only non-live fixtures. Full domain smoke runs after Streams D–G. The 31 October run exercised the then-current 12 tools. The 5 November handoff smoke discovers 14 tools and verifies the new report read/submit flow; this does not re-certify every retained legacy path. Neither script sends email, notifications or CRM writes.

Installed Codex CLI verification: `codex mcp add cbb_ops --url https://YOUR-PREVIEW/api/mcp --bearer-token-env-var CBB_OPS_TOKEN`. This is documentation only; no connector was installed or configuration changed.

## Report review and recovery

Report edits and review/send actions require `expected_updated_at` from the last read. Conflicting edits return 409. A send atomically locks the reviewed revision before contacting the provider; a disabled send releases the lock and sends nothing. A provider error leaves the claim locked for manual delivery reconciliation before any retry. Do not clear a claim until delivery has been checked.

An early-week snapshot refreshes automatically on Thursday. The report page also offers **Refresh source data** for an explicit current-week refresh. Historical snapshots reject refresh before any other report can be created. Refresh preserves saved human narrative and observations, refreshes figures without generating or replacing report text, resets review to draft and asks the reviewer to reconcile any retained narrative against the new figures. Sent reports cannot be edited or refreshed. Unsaved edits must be saved before refresh.

Onboarding transitions and checklist completion commit atomically and cannot move backwards. Payment reminder counts derive from unique ledger events after the latest successful payment, so out-of-order delivery cannot hide a reminder or reopen a paid cycle. Work-list pagination includes history beyond the first 1,000 rows.

New-client activation creates the invite and attempts its existing welcome flow before the Ops onboarding dependency. A failed Ops start returns a retryable failure; replay for an existing user resumes idempotent onboarding without another invite or welcome send. Live new-client webhooks were not replayed in this build; the regression uses mocked invite and email functions.

## Client privacy and statistics

The eleven new Ops signal fields on client_profiles are not available to the authenticated client role for SELECT, INSERT or UPDATE. Legacy column grants are retained; service-role admin/Ops handlers remain the access path for operational data. Client me/dashboard responses use an explicit public profile projection, so future internal columns are not automatically exposed. Archived clients are excluded from the attention tool.

The Social Planner statistics POST includes its required `locationId` query parameter, as documented in the [official reference](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/social-planner/get-statistics/index.html). The contract test mocks HTTP; no CRM write occurs.

The old non-live database lacks some current-app baseline fields. Only the existing lesson-attachment and archive columns were added for compatibility. Its existing self-referential users RLS policy produces 42P17 on direct authenticated SDK reads; this historical policy is not changed by the build. Column privileges were independently checked through the catalog, and actual client settings/me/dashboard plus Ops API flows were exercised. Do not call the legacy direct SDK check a pass.

Proposal revisions and completion accounting: an identical approval upsert preserves the decision and timestamp. Changing its title, detail, proposed links/outputs or payload reopens review and clears the old decision; generic edits do the same. Output receipts appended with attach_output do not replace a proposal. Reopened approvals use a revision-specific notification key. Repeated completion requests remain in the audit trail as status_unchanged; only an actual transition into done is reportable as a completion.

Connected account identifiers come from results.accounts[].id in the [official accounts response](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/social-planner/get-account/index.html) and are passed as profileIds to statistics. The mocked response uses that documented shape.

Approval responses expose proposal_revision. Assignment changes and appended delivery receipts retain it; proposal changes or explicit review reopening increment it. Creation, generic edits and explicit reopening share the same revision-keyed, best-effort notification path. No notification delivery was exercised during this build; the adapter test uses a mock.
