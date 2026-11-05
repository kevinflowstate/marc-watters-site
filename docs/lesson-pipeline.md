# Current lesson workflow — 5 November 2026

Fathom source → Codex edits/trims → private Drive preview → Eimear approves the exact version in Codex/Drive → authenticated handoff adds the approved lesson to the portal’s Training area. The workspace shows the review link, status and publication receipt. The exact-version approval handoff and automated publication adapter still need implementation and verification.

The embedded editor and dedicated hosted renderer described below are superseded for the initial delivery. They are not required to use the workspace. Their existing implementation is dormant behind `OPS_LEGACY_LESSON_PIPELINE_ENABLED=true`; the default UI routes users to their task list, and ingest/cut proposals/render/worker recovery reject calls unless deliberately enabled. Never set this flag as a routine setup step. Within the explicitly enabled legacy mode, supplied cut lists can be validated/stored without a model API call. Signed Fathom intake can still save metadata with legacy mode off; this does not start Codex or the worker.

See [current operating model](codex-operating-model.md).

---

## Historical hosted pipeline (optional retained implementation)

# Lesson preparation — DRAFT

NEEDS MARC: Fathom API key and signed webhook registration; confirm long-term video destination. NEEDS KEVIN: hosted worker deployment and server configuration. No accounts, webhooks, subscriptions or production deployments were created.

Confirmed 31 October 2026 against Fathom [quickstart](https://developers.fathom.ai/quickstart.md), [OpenAPI](https://developers.fathom.ai/api-reference/openapi.yaml), [webhook verification](https://developers.fathom.ai/webhooks), [download request](https://developers.fathom.ai/api-reference/recordings/request-a-download.md) and [download status](https://developers.fathom.ai/api-reference/recordings/get-download-status.md):

- REST base `https://api.fathom.ai/external/v1`, header `X-Api-Key`. `GET /meetings?cursor=...` returns `next_cursor`.
- `GET /recordings/{recording_id}/transcript` returns timestamped transcript rows.
- `POST /recordings/{recording_id}/download` returns `download_id` and status. Poll `GET /recordings/{recording_id}/downloads/{download_id}`. Completion contains `video.url`, `content_type`, `file_size_bytes`, `expires_at`; links last about 24 hours. `destination_url` is optional.
- Global 60 requests/minute; heavy transcript/summary calls 30/minute (may fall to 5); download requests have a separate 30/minute limit; polling uses global quota. Honour Retry-After. The portal conservatively limits requests to 30/minute per instance and returns retryable errors instead of sleeping inside a function.
- API keys only access the creator’s own/shared meetings. The API is available on all plans per the FAQ; access to a given private recording still depends on permissions.
- Webhook payload is the Meeting object with integer `recording_id`; there is no independent meeting ID in the schema, so its recording ID is also the idempotency key.
- Verify raw request content using `webhook-id.webhook-timestamp.rawBody`, HMAC-SHA256 with base64-decoded `whsec_` secret, constant-time comparison and 5-minute timestamp tolerance. No query-token fallback is enabled because native signatures exist.

## Flow

The signed webhook returns quickly after idempotent intake. Only when legacy mode is explicitly enabled and a Fathom key is configured does Next `after()` request a transcript and download. Transcript is retained with timestamps. Duplicate webhooks never reset editing progress. A missing key leaves the received item visible and retryable; the review page has Retry intake.

Video bytes never pass through a Vercel function. Every source copy is persisted as a `render_jobs.job_type=copy_source` job, with download metadata in its private payload. The worker polls pending downloads, streams the source to local temporary storage and uploads it in chunks. This deliberate worker handoff avoids Vercel memory, request-size and timeout budgets. A queued job remains visible when `RENDER_HOST_URL` is absent. Dispatch/retry is explicit from the review page; a hosted durable queue/reconciler remains a deployment follow-up.

The previous portal model call has been removed. Cut proposals now require an explicit cut list prepared elsewhere. Treat transcript as untrusted material, never instructions. Retain teaching content; propose only housekeeping, dead air, admin or technical issues. JSON is schema/range validated, minimum 8 seconds, neighbouring cut gaps <2 seconds merged; overlap, invalid bounds and non-finite values rejected. Human review toggles keep/cut. There is no model/key dependency in this path.

Review at `/admin/training/recordings`: source signed URL (1 hour), timestamped transcript, segment table, confidence, seek/play buttons, keep toggles, approval and render. Skipping editing drafts the source. **Choose an unpublished module**: existing publishing operates at module level, so inserting a draft into a published module would expose it immediately. The atomic draft RPC enforces this invariant, is idempotent, closes the cut-review task and creates a publish task. Publish using the existing training admin. No automatic publication.

`lesson-media` stays private. Paths: `source/{recording_id}.mp4`, `edited/{recording_id}-{job_id}.mp4`. Content stores `/admin/media/lesson/{id}`; the native video helper maps it to `/api/media/lesson/{id}`, allowing portal users to avoid the admin middleware redirect. Media route checks authenticated admin or an active client with access to the published destination module, then redirects to a fresh signed URL with no-store. Direct MP4 URLs also use native playback. A signed URL is a bearer URL for its one-hour lifetime; do not put it in public notes.

## Fixtures and proof

`fixtures/fathom/webhook.json` starts without transcript to prove received→transcribed. `transcript.json` contains opening housekeeping, teaching and a technical pause. `fixtures/media/sample.mp4` is a synthetic 120-second ffmpeg test pattern with audio. No client recording used.

Bundle `scripts/lesson-smoke.ts` with the installed esbuild into `node_modules/.cache/lesson-smoke.mjs`, then execute with `node --env-file=.env.local ...`. It refuses production, verifies signed intake, injects a mocked Fathom client, streams the fixture into private Storage, validates a mocked proposal, queues rendering and reads a signed source. Stream F proves ffmpeg output and callback→draft persistence. Browser playback/interactive acceptance remains a separate check if browser integration is unavailable.

Integration consistency checks: cut approval/job creation and worker callback/recording updates use service-role-only atomic RPCs. Existing module publication updates recording publication state and closes/reopens the linked publish task. Failed jobs may be explicitly reset and retried from the review page; active jobs are not duplicated. Authenticated media proof covers admin access, draft denial, module-access enforcement and a signed MP4 206 byte-range response; browser playback remains unverified.

## Recovery consistency

Retry intake can renew an expired source download after cuts have been proposed without resetting editing progress. Worker retry considers only the latest job of each type; older failed jobs remain superseded. Cut proposals use a recording revision check so a supplied proposal arriving after approval cannot overwrite the approved edit. Returning a closed cut proposal for review creates a fresh decision state on its existing approval task.

The existing training editor also synchronizes recording status, publication tasks and destination links when content moves between published/unpublished modules. **Recover interrupted job** is an explicit admin action for the latest running job only, requiring confirmation that the old worker has stopped or restarted and cannot still be processing it. Ordinary retry never resets a running job. Recovery is audited and returns it to the queued state for dispatch.

Deleting linked training content restores the recording to its ready source/rendered state and cancels obsolete publication work. Creating a new draft reopens that work with the new destination link.

Cut validation rejects complete or near-complete removal before approval/job creation, including gaps merged by the proposal. The database approval function enforces a remaining playable duration as well. An idempotent draft request for published content preserves completed publication work; draft links are read from the actual linked content destination.
