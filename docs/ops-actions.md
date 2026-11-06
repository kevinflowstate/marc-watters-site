# Prepared work, approval and execution

Migration `023_ops_actions.sql` adds immutable content/lesson versions, human decision history and persistent per-item execution results. It performs no provider action. Production installation and actual external execution must be enabled/tested separately.

## The persisted contract

`ops_artifacts` stores each version as its own row. A SHA-256 digest covers canonical JSON containing `kind`, `action`, `title`, `payload`, `destination` and the ordered `item_keys`. Object keys sort lexically; array ordering is preserved; non-finite numbers, undefined values, non-plain objects and oversized/deep JSON are rejected. Changing copy, media hash, time, destination, title or item ordering changes approval identity.

Submission accepts only:

```json
{
  "external_ref": "content:2026-11-09:brief-1",
  "kind": "content",
  "action": "schedule_content",
  "title": "Review this week's content",
  "payload": {},
  "destination": {},
  "item_keys": ["post-1"]
}
```

The content/lesson adapter must validate its domain manifest before execution. Generic preparation only guarantees finite bounded JSON and a matching kind/action. `content` uses `schedule_content`; `lesson` uses `publish_lesson`. A lesson's draft/publication mode belongs inside the approved payload.

A revised submission adds `expected_version` and `expected_manifest_hash` for the current external reference. The latest row is locked; another edit returns a conflict. Identical retries reuse the existing row. A changed proposal inserts a new version, supersedes the previous row and clears its effective approval. Once any execution started, editing that reference is refused; reconcile its results first and deliberately prepare a separate action for any genuinely new work. This prevents a partially successful pack revision from silently scheduling its successful posts again.

## Authenticated decisions

`decideArtifact(id, {version, manifest_hash, decision, note}, authenticatedAdminUserId)` calls an atomic RPC. Root routes must obtain the user ID from `adminActor()`, not request JSON, an integration token or a display name. SQL checks that user is an admin. The current row, exact version/hash, action and destination are bound to the immutable decision record. A stale/superseded proposal cannot be approved. Rejection requires a note. Submissions cannot supply status, actor, approval or receipt fields.

This establishes authenticated portal approval. A decision in an unrelated Codex/Drive session still needs an authenticated bridge; a JSON field saying Eimear does not provide that bridge.

## Execution and recovery

1. Root validates the domain manifest, intended provider account and configured execution gate.
2. `claimArtifact(id, {version, manifest_hash}, adminUserId)` obtains/reuses the persisted execution claim. It requires an exact recorded approval. A completed artifact is a readback result; stop before processing items. A completed artifact reconciled manually can have a null claim ID.
3. For each item call `claimArtifactItem(id, claim_id, item_key)`. Only `{claimed:true}` authorises that caller to make the external request. An already running, succeeded, failed or unknown item returns `claimed:false` and must not be recreated. Concurrent clicks share the claim and cannot both claim one item.
4. Persist the actual result using `recordArtifactItem(..., {status, receipt, error})`. Allowed outcomes are `succeeded`, `failed`, `unknown`. Success requires a nonempty provider/publication receipt. An identical repeated result is a no-op. A timeout/ambiguous result is `unknown`, not a confirmed failure. An adapter may settle an item atomically with its publication RPC; root can read it back or repeat the identical receipt.
5. `finishArtifact(id, claim_id)` completes only when every item succeeded; otherwise it exposes `needs_attention`. It leaves the artifact running when any item is still running, so one click cannot close another executor's active item early.

Failed and unknown items never become pending automatically. `reconcileArtifactItem(id, item_key, {expected_updated_at, resolution, receipt, note, executor_stopped?}, adminUserId)` requires a current item revision and evidence. A verified result uses `resolution:"succeeded"` plus receipt. `retryable_failure` is only appropriate after confirming no provider action occurred; it returns the item to pending and permits a subsequent explicit execute request. For a running item the old executor must actually be stopped and `executor_stopped:true` supplied. Another running item prevents reconciliation. If the old execution may still complete, leave the claim locked.

Reconciliation is audited separately. Successful sibling items keep their receipts and are never reset. The resulting artifact is completed, still needs attention, or approved for pending items. No provider request is hidden in a claim, decision or reconciliation function.

## Scoped Codex connection

New integration routes use `requireOpsScope(request, scope)`. Configure server-only `OPS_SCOPED_TOKENS_JSON` as an array of `{id,sha256,scopes}`. `sha256` is the lowercase SHA-256 digest of a strong separately distributed bearer token, not the token itself. No credential was generated or installed by this code change. Never expose the configuration/token in browser variables, Git, logs or portal payloads.

Allowed scopes: `artifacts:read`, `artifacts:write`, `reports:read`, `reports:write`, `tasks:read`, `tasks:write`, `payments:read`, `portal:read`. `portal:read` exposes the paginated, read-only client correspondence/activity interface described in [portal monitoring](portal-monitoring.md); it does not grant task writes. There is no integration scope for approval, execution, publication or messaging. No fallback to the old broad `OPS_API_TOKEN` exists in this helper. A valid token outside its configured scope returns 403; unknown/missing tokens return 401. Credential IDs/hashes must be unique and invalid configuration fails closed. Rate limits are per credential.

Task/report REST and MCP now explicitly accept scoped credentials. `action-access.ts` preserves the explicitly configured broad token separately for legacy callers; do not distribute that token as a scoped connection. Scoped task creation is open/awaiting-review with AI source; edits cannot decide, complete, cancel, change task kind or replace execution outputs. Scoped POST to a task can append an output only. Legacy decision/complete behaviour remains legacy-only. Report write scope permits gathering figures and submitting draft wording, not human review/send. MCP builds its tool list per authenticated request and advertises only that credential's permitted tools. Private client summaries, transcript/legacy-cut tooling and onboarding mutations remain legacy-only. The broad MCP list now has 17 tools; narrow lists depend on scopes.

New bearer endpoints:

| Route                         | Scope             | Result                                                |
| ----------------------------- | ----------------- | ----------------------------------------------------- |
| `GET /api/ops/artifacts`      | `artifacts:read`  | Latest 500 version rows, including superseded history |
| `POST /api/ops/artifacts`     | `artifacts:write` | Submit/revise an unapproved immutable proposal        |
| `GET /api/ops/artifacts/{id}` | `artifacts:read`  | Proposal and actual item results                      |

Human decision/execution/reconciliation routes are composed separately by the portal integration. Existing legacy task decisions must not become available merely by assigning a Codex token `tasks:write`.

Existing task/report bearer endpoints now use `tasks:read`, `tasks:write`, `reports:read` and `reports:write` as appropriate. Scoped task writers can prepare work and append an output; report writers can gather figures and submit draft text. No scope gives human review/send authority.

## Database boundary and verification

All five tables enable RLS and revoke access from public/anonymous/authenticated roles. Only service-role RPC callers can mutate/read them through these routes; human authority is checked inside decision/claim/reconciliation RPCs. Approval content columns are protected by an immutable-row trigger even for direct updates. RPCs lock the artifact before its items, and submissions serialise by external reference to handle concurrent first creation and revisions.

`recordArtifactImport(id, {provider:"google_drive",file_id,version,sha256}, adminUserId)` records pinned Drive manifest readback only after the content import route has verified those bytes/version. The database binds provenance to the immutable artifact hash. The content manifest's `source` may identify its brief, rather than the manifest file being imported. Identical provenance retries return the saved row; conflicting provenance is refused. New provenance must be attached while the artifact is draft. This trusted service/admin attestation does not change payload or grant approval.

Focused tests cover canonical approval identity, changed action inputs, malformed/oversized proposals, forged fields, scoped-access denial, no broad-token fallback, receipt requirements, conflict propagation, scoped task mutation refusal and concurrent MCP requests with different scopes. Actual PostgreSQL concurrency, migration execution and provider behaviour require separate non-live integration checks; unit tests do not prove those external systems.
