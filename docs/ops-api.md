# CBB Operations API

Draft foundation; integration PR stays unmerged. No production migration/deployment is authorised.

All `/api/ops/*` and `/api/mcp` requests require `Authorization: Bearer <OPS_API_TOKEN>`. The token is compared by constant-time SHA-256 digest equality. An in-process limit of 120 authenticated requests/minute applies across these endpoints per instance; use a shared external limiter before scaling to multiple instances. Missing/invalid tokens return 401, exhausted limits 429. Admin `/api/admin/work` uses the existing signed-in admin check. Secrets are never browser variables. Outputs must be HTTP(S) or portal-relative URLs.

| Endpoint | Methods | Behaviour |
|---|---|---|
| `/api/ops/tasks` | GET, POST | Filter by status/area/assignee/clientId; create or upsert external_ref |
| `/api/ops/tasks/{id}` | PATCH, POST | Update fields; POST `{decision:"approved"|"rejected",note}` or `{output:{label,url,type}}` |
| `/api/ops/clients` | GET | Client signals and user summary |
| `/api/ops/clients/{id}` | GET | One client |
| `/api/ops/clients/{id}/onboarding` | POST | Advance onboarding (Stream D) |
| `/api/ops/lessons` | GET | Recording queue |
| `/api/ops/lessons/{id}` | GET, POST | Read; ingest/propose/approve/draft actions (Stream E) |
| `/api/ops/render-jobs/{id}` | PATCH | Worker progress/output callback |
| `/api/ops/reports` | GET, POST | List; create current weekly draft |
| `/api/mcp` | POST | Streamable HTTP, stateless; authenticated GET/DELETE may return 405 |

```sh
curl "$PORTAL/api/ops/tasks?area=content" -H "Authorization: Bearer $OPS_API_TOKEN"
curl "$PORTAL/api/ops/tasks" -H "Authorization: Bearer $OPS_API_TOKEN" -H 'Content-Type: application/json' --data '{"kind":"approval","title":"Review caption","area":"content","external_ref":"content:example:1"}'
```

MCP tools: `create_task`, `list_tasks`, `update_task`, `request_approval`, `attach_output`, `get_client`, `list_clients_needing_attention`, `get_lesson`, `list_lessons`, `propose_lesson_cuts`, `create_report_draft`. `update_client_onboarding` is added in Stream D. Each has a JSON schema and a plain-language description. AI-generated outputs go to human approval; these tools do not publish content or send client messages.

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

All values pass through `lib/env.ts` normalisation (`.trim()` plus pasted literal newline cleanup): `OPS_API_TOKEN`, `OPS_WEBHOOK_SECRET`, `FATHOM_API_KEY`, `FATHOM_WEBHOOK_SECRET`, `RENDER_HOST_URL`, `RENDER_HOST_SECRET`, optional `GHL_LOCATION_TOKEN`, `OPS_REPORT_SEND_ENABLED` (default false), `OPS_NOTIFICATIONS_ENABLED` (default false). Existing `ANTHROPIC_API_KEY`, `CRON_SECRET`, `WEBHOOK_SECRET`, `RESEND_API_KEY` remain server-only. Existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` identify only the permitted non-live project for these branches; service-role keys are never public. Do not reuse production webhook/cron secrets in previews.

Non-live database: `abmmlybdqwzujcysagvf`. Production `eeatjpbwwkgytznkfdww` is forbidden for this build. New migrations are additive numbered 019–022; apply only to non-live/local. Scripts refuse production targets. The old non-live database predates some portal columns; record any baseline compatibility requirements separately.

## Verification

`OPS_TEST_ACCOUNT=/private/test-account.json node --env-file=.env.local scripts/ops-admin-smoke.mjs` exercises admin work API against port 3087.

`node --env-file=.env.local scripts/ops-smoke.mjs` checks all REST routes and every tool through the official MCP SDK client. It needs a disposable demo client/recording/render job via `OPS_SMOKE_CLIENT_ID`, `OPS_SMOKE_LESSON_ID`, `OPS_SMOKE_JOB_ID`; use only non-live fixtures. Full domain smoke runs after Streams D–G. Neither script sends email, notifications or CRM writes.
