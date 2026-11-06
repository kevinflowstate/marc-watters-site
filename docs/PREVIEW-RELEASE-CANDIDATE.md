# CBB preview release candidate

Verified 6 November 2026. This is an isolated-preview handover, not authority to merge, deploy production or enable outbound actions. Claude's workspace layout remains the UI baseline.

## Reviewed deployment

- Application source: `6acab682a0e22a95973bd6b6aef2880acc590c4f`, branch `codex/cbb-ops-foundation`, draft PR32.
- Stable preview: https://marc-watters-site-git-code-75af51-kevinflowstate-7682s-projects.vercel.app/admin/work
- Vercel deployment: `dpl_4jUsXac3gnUdkKMgdFtMenMLGnzZ` (READY).
- Only database `abmmlybdqwzujcysagvf` was changed/tested. Production database `eeatjpbwwkgytznkfdww` was not changed.
- Later documentation-only commits do not establish a newer tested runtime.

## What has actually passed

| Workflow | Built/tested | Real source or provider check | Human/real action acceptance |
| --- | --- | --- | --- |
| Private content review | Exact-version upload, immutable hashes, private readback, changed delivery manifest requires fresh review; scheduling retries/partial results covered by mocks | All five existing carousel images uploaded/read back with exact SHA256; anonymous access denied; existing Drive manifest and three CRM destinations verified | Carousel remains draft with zero approvals. Public approved-media delivery and actual social scheduling not proven |
| Client attention | Stateful read/reply/reopen, archived/paused handling, task replay and ownership | Hosted synthetic client journey persisted, replay returned the same Eimear task, and scoped completion was refused403; owned test rows removed | Production-client coverage, Eimear account and response rules pending |
| New-client intake | Sending-off code now holds unknown clients for Eimear's access review before Auth/profile/module creation; lookup failures503, malformed input400;40 focused tests | Hosted new-client webhook trial not run: no local preview webhook credential configured | Admission offer/payment, community/welcome destination and real invitation trial pending |
| Payments | Immutable case/run, due dates, one-use dispatch, receipt checks, paid/reply/DND/pause holds, two-reminder cap and Eimear handoff; three SQL acceptance fixtures pass and roll back | Both exact Utility/UK-English templates Active/selectable in GHL. Saved workflow remains trigger-only Draft, zero enrolments | Native context across waits, message ID and retry semantics unproven. No provider delivery test or active Stripe intake |
| Lesson storage | Private path-specific signed upload/readback grants; resumable TUS uploader; export-size planning and unchanged256MiB publication verifier | Actual synthetic20,913-byte MP4 uploaded via signed TUS endpoint and fully read back with exact SHA | No real Fathom lesson/export or hour-long transfer/playback test; key and global storage cap still need checking |
| Codex reports/startup | Strict stable-origin/database/revision/seven-switch probe; immutable result replay and readable report rules | Updated cloud environment published; fresh task verifies120 source blobs/eleven skills and actual five paused job records | Fresh two-private-report acceptance recorded in knowledge handover; no scheduled/mobile/laptop-off trial implied |

Portal full suite:434 tests across51 files; build/TypeScript pass; scoped lint and diff checks pass. Knowledge suite:66 tests, followed by8 signed-upload protocol tests after the provider endpoint correction. Current preview UI changes lack a fresh desktop/mobile visual pass: Chrome and in-app preview controls timed out, and the bounded browser routes were stopped. Earlier report-layout visual checks are historical, not proof of the new controls.

Local evidence is in the existing `cbb-ops-build/evidence` directory: `finish-sprint-deployed.json`, `finish-content-deployed.json`, `client-handoff-deployed.json`, `lesson-transfer-provider-fixed.json`, `lesson-private-live-readback.json`, `finish-sprint-tests.log`, `finish-sprint-build.log` and `finish-knowledge-tests.log`. No secrets/private report bodies are committed with this document.

## Migration and access plan for a separately authorised rollout

Recheck target identity, applied migration history, existing policies and recoverable backup first. Do not replay the repository's entire historical migration directory blindly. The ops additions must be applied in this dependency order if absent:

1. `019_ops_tasks.sql`
2. `020_client_admin_signals.sql`
3. `021_lesson_pipeline.sql`
4. `022_ops_reports.sql`
5. `023_ops_actions.sql`
6. `024_ops_payment_cases.sql`
7. `025_ops_lesson_publication.sql`
8. `026_ops_payment_calendar.sql`
9. `027_ops_workspace_results.sql`
10. `028_ops_payment_delivery.sql`
11. `029_ops_content_media.sql`

This sprint applied only029 to the already prepared isolated database. It creates private `ops-content-media`, accepts PNG/JPEG up to3MiB and adds no public/client Storage policy. Read back bucket privacy and review all existing Storage policies; do not assume a newly private bucket is safe from a pre-existing catch-all policy. Preview readback found no such exposure. The lesson bucket remains private; its unset per-bucket size cap does not prove the service's global cap is unlimited.

Use environment-owned secrets only, separate by target. Relevant configured names include `CBB_GHL_PIT_TOKEN`, `CBB_GHL_USER_ID`, `GHL_LOCATION_TOKEN`, `OPS_CONTENT_DRIVE_SERVICE_ACCOUNT_JSON`, `OPS_CONTENT_DRIVE_FILE_IDS`, existing Supabase server credentials and `WEBHOOK_SECRET`. Do not copy preview credentials into production automatically. `OPS_CONTENT_MEDIA_HOSTS` must allow only a deliberately approved immutable delivery host; private preview URLs are not publicly fetchable social assets.

Marc's cloud has only the existing read/draft/task scopes on the exact stable preview host, with access expiring20 November. It cannot approve, send or publish. Drive access is Viewer on one exact handoff file, not the Business Hub/folder. Keep file-ID/version/hash checking; future content updates require a new review. Live client identity mapping must be verified per Stripe merchant/invoice and GHL contact; preview test profiles are not live client mappings.

Keep all seven variables explicitly false, then independently read `/api/ops/identity` and the admin connections endpoint:

- `OPS_CONTENT_SCHEDULING_ENABLED`
- `OPS_LESSON_PUBLICATION_ENABLED`
- `OPS_PAYMENT_REMINDERS_ENABLED`
- `OPS_REPORT_SEND_ENABLED`
- `OPS_NOTIFICATIONS_ENABLED`
- `FLOWSTATE_PORTAL_SEND_ENABLED`
- `OPS_LEGACY_LESSON_PIPELINE_ENABLED`

Verify the five actual Codex scheduler records remain disabled with no next run. Environment publication and saving a draft must not change them. Do not connect an active event source until the specific workflow's controlled trial and business rules are agreed.

## Smoke checks and rollback

After a separately authorised deployment: verify exact app/database/revision; anonymous401 and insufficient-scope403; private image byte/hash readback; same-input result replay without duplication; reply/reopen/task ownership; no account creation with onboarding sending off; all seven switches false; five actual jobs paused. Use owned synthetic fixtures only. Exercise the visible review controls on desktop/mobile and Eimear's own account before claiming team readiness.

For an application regression, stop new intake, retain all outbound switches false, preserve provider receipts and return the deployment/alias to the previous reviewed compatible revision. Repoint Marc's exact-host connection only if the intended preview still passes identity checks. Keep additive tables/buckets and saved human decisions: do not destructively drop migrations or erase unknown dispatches as rollback. If a schema repair is required, prepare a forward fix or restore the verified backup with explicit approval. Never reset an uncertain send or re-enable a workflow automatically.

## Remaining decisions

- Confirm admission offer/payment, community/welcome destination and question/check-in ownership.
- Choose/prove approved immutable public media delivery; leave unapproved art private.
- Prove native GHL run context, message-ID mapping and retry behaviour using an explicitly permitted controlled recipient, or review a server-owned sender alternative. Templates alone do not complete this.
- Add the protected Fathom API key and exact media access, then test one complete real lesson, storage cap and playback.
- Confirm ledger/accounting destination and current reporting coverage. Missing data must remain missing.
- Complete Eimear/mobile/unattended trials, then separately authorise production rollout and each activation.
