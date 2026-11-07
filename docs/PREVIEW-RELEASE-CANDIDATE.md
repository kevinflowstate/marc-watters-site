# CBB preview release candidate

Verified 6 November 2026. This is an isolated-preview handover, not authority to merge, deploy production or enable outbound actions. Claude's workspace layout remains the UI baseline.

## Reviewed deployment

- Application source: `a8c7acef74cac17bb142bab14f5b2e62221d04dd`, branch `codex/cbb-ops-foundation`, draft PR32.
- Stable preview: https://marc-watters-site-git-code-75af51-kevinflowstate-7682s-projects.vercel.app/admin/work
- Vercel deployment: `dpl_DDyqCmCuw4GJAbCptWbDNzJPFBXG` (READY).
- Only database `abmmlybdqwzujcysagvf` was changed/tested. Production database `eeatjpbwwkgytznkfdww` was not changed.
- Later documentation-only commits do not establish a newer tested runtime.

## What has actually passed

| Workflow | Built/tested | Real source or provider check | Human/real action acceptance |
| --- | --- | --- | --- |
| Private content review | Exact-version upload, immutable hashes, private readback, changed delivery manifest requires fresh review; scheduling retries/partial results covered by mocks | All five existing carousel images uploaded/read back with exact SHA256; anonymous access denied; existing Drive manifest and three CRM destinations verified | Carousel remains draft with zero approvals. Actual synthetic approved-image signed download passed; drafts/wrong versions refused. Real social ingestion/scheduling remains untested |
| Client attention | Stateful read/reply/reopen, archived/paused handling, task replay and ownership | Hosted synthetic client journey persisted, replay returned the same Eimear task, and scoped completion was refused403; owned test rows removed | Production-client coverage, Eimear account and response rules pending |
| New-client intake | Sending-off code now holds unknown clients for Eimear's access review before Auth/profile/module creation; lookup failures503, malformed input400;12 current focused tests plus hosted trial | Hosted concurrent first intake and replay passed: one Eimear task, her completion/note preserved, no Auth/user/profile/module/invite/notification writes; bad secret401 and five malformed inputs400 | Admission offer/payment, community/welcome destination and real invitation trial pending |
| Payments | Immutable case/run, due dates, one-use dispatch, receipt checks, paid/reply/DND/pause holds, two-reminder cap and Eimear handoff; three SQL acceptance fixtures pass and roll back | Both exact Utility/UK-English templates Active/selectable in GHL. Saved workflow remains trigger-only Draft, zero enrolments | Native context across waits, message ID and retry semantics unproven. No provider delivery test or active Stripe intake |
| Lesson storage | Private path-specific signed upload/readback grants; resumable TUS uploader; export-size planning and unchanged256MiB publication verifier | Actual synthetic20,913-byte MP4 uploaded via signed TUS endpoint and fully read back with exact SHA | No real Fathom lesson/export or hour-long transfer/playback test; key and global storage cap still need checking |
| Codex reports/startup | Strict stable-origin/database/revision/seven-switch probe; immutable result replay and readable report rules | Updated cloud environment published; fresh task verifies120 source blobs/eleven skills and actual five paused job records | Fresh two-private-report acceptance recorded in knowledge handover; no scheduled/mobile/laptop-off trial implied |

Portal full suite:452 tests across53 files; build/TypeScript pass; scoped lint and diff checks pass. Knowledge suite:66 tests, followed by8 signed-upload protocol tests after the provider endpoint correction. Current hosted browser checks passed at1440×1000 and390×844: report sections, retained supporting notes, private images, review filters, off/initial-unknown controls, scheduling preflight, payment history and synthetic task completion. All five1080×1350 carousel images loaded privately. No console errors or horizontal overflow observed. A failed-settings request and failed-image retry remain covered by focused tests, not a forced browser network failure. Eimear’s own login remains untested.

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
12. `030_ops_onboarding_create_once.sql`

The earlier sprint applied029; the current sprint applied030 only to the same isolated database.030 adds a service-role-only create-once onboarding RPC, using the same reference lock as task writes, preserving existing human fields and atomic audit. Its SQL acceptance fixture passed and rolled back.029 creates private `ops-content-media`, accepts PNG/JPEG up to3MiB and adds no public/client Storage policy. Read back bucket privacy and review all existing Storage policies; do not assume a newly private bucket is safe from a pre-existing catch-all policy. Preview readback found no such exposure. The lesson bucket remains private; its unset per-bucket size cap does not prove the service's global cap is unlimited.

Use environment-owned secrets only, separate by target. Relevant configured names include `CBB_GHL_PIT_TOKEN`, `CBB_GHL_USER_ID`, `GHL_LOCATION_TOKEN`, `OPS_CONTENT_DRIVE_SERVICE_ACCOUNT_JSON`, `OPS_CONTENT_DRIVE_FILE_IDS`, existing Supabase server credentials and `WEBHOOK_SECRET`. Do not copy preview credentials into production automatically. Approved private images can now use path-specific signed Storage download URLs. The preview policy is explicitly604800seconds maximum lifetime and86400seconds retained after the scheduled time: dates beyond that horizon fail closed. This is an access policy, not proof of when GHL/social platforms fetch the image. The actual synthetic proof used300/60seconds and verified anonymous bytes/hash, then removed its own object/artifact. The real carousel was never approved or signed. `OPS_CONTENT_MEDIA_HOSTS`, if used for external sources, must allow only a deliberately approved immutable host. Protected preview URLs are not social delivery assets.

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
- Prove HighLevel/social ingestion timing and receipt readback under separately permitted controlled posting. Signed approved-image downloading now works; drafts remain private. No post was created.
- Prove native GHL run context, message-ID mapping and retry behaviour using an explicitly permitted controlled recipient, or review a server-owned sender alternative. Templates alone do not complete this.
- Add the protected Fathom API key and exact media access, then test one complete real lesson, storage cap and playback.
- Confirm ledger/accounting destination and current reporting coverage. Missing data must remain missing.
- Complete Eimear/mobile/unattended trials, then separately authorise production rollout and each activation.

## Delivery sprint evidence

Verified runtime a8c7ace on6November. Local evidence: `delivery-full-tests.log`, `delivery-build.log`, `intake-deployed.json`, `signed-content-live.json`, `delivery-ui-task.json`, `delivery-readable-report.json` and `delivery-*-mobile.png` in cbb-ops-build/evidence. All owned synthetic intake/image/task records were removed after checks. All seven deployed action switches were independently false; five Marc cloud jobs were untouched (latest direct paused/no-next-run verification18:35). No production database, client send, social post, real-carousel approval or full-week artwork change.

The latest weekly portal result is a new immutable wording correction with its original18:27 source timestamp and partial coverage. Prior result/Drive source and earlier notes are retained. The three improved report guidance files from knowledge revision5a3036a were installed and the environment published at19:45. A separate fresh chat at19:48 verified all three hashes, preservation of the other117 baseline files, eleven skills, all five paused jobs and seven false portal controls. See knowledge docs/CLOUD-ACCEPTANCE.md; no new report was generated for that test.

## Payment reliability continuation — 6 November 2026, after 20:00 London

The payment source reader now anchors freshness before the invoice request, preventing a slow older read from gaining a newer timestamp merely by finishing later. Subscription ID, object, live/test mode and current status must be verified before treating an open invoice as chaseable. Synthetic ingress tests cover both merchants, wrong-mode/signature rejection, old failure/current paid state, held subscription states and out-of-order read completion.

Payment cards require a verified provider receipt/send timestamp before claiming a confirmed send or delivery. They distinguish saved status from checked history, show Eimear's next action and source-check time, and link the exact merchant's invoice. Account display names remain unavailable and explicitly need confirming. Task completion does not imply payment or sending.

Additive migration031_ops_payment_human_notes.sql was applied only to isolated preview abmmlybdqwzujcysagvf. It preserves the person's decision note and attribution when Stripe closes a paid task; the automatic closure reason is saved separately in the audit event. The rollback fixture reproduced the old failure, then passed after the fix. Repeated closure stays idempotent, service-only access remains, and no synthetic case/task rows remain.

Current local verification:480 tests across55files, scoped lint and production build pass. Hosted application deployment/visual acceptance for this continuation is recorded in the project handover after completion. Native GHL saved-node evidence belongs in docs/payment-workflows.md. Native context/message-ID/retry acceptance, both merchant ingress registrations and activation remain separate from these tests. All jobs/action flags remain paused/off; no client message or test enrolment is authorised by this checkpoint.
