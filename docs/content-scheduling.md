# Approved weekly content scheduling

Codex prepares the copy and a versioned JSON manifest in Drive. The portal stores an immutable copy, displays the exact copy/accounts/times/media, and records an authenticated human decision against that version. Its action runner claims each post before calling the adapter and saves every result. Approval and a successful scheduling result are separate states.

This implementation is **non-live, default dry-run**. No post was created in Marc's account during development. The original Flowstate-only `social-planner.ts` scaffold and its guard are unchanged.

## Supported first delivery

JPEG/PNG feed image posts and image carousels for Facebook, Instagram and LinkedIn, with exactly one account/platform per post. Facebook/Instagram allow 1–10 ordered images in this adapter; regular LinkedIn feed posts allow 1–9. Captions are limited to 2,200 characters on Instagram and 3,000 elsewhere. Stories, reels, videos, polls, tagged users, platform-specific PDF conversion and generated media are outside this adapter. They must not be silently converted to feed posts.

One account per post avoids the provider's cross-platform caption trimming and lets the portal record each destination independently. The current official API uses `Version: v3`, accepts a scheduled status plus `scheduleDate`, and requires accessible HTTPS media. See [Create post](https://marketplace.gohighlevel.com/docs/ghl/social-planner/create-post/).

## Manifest

See `fixtures/content/image-pack.json`, a synthetic example with future dates and deliberately unusable fixture media. It is for dry-run/review only.

```text
schema_version: 1
pack_id, version, timezone: Europe/London
location_id: Marc's verified CRM location
source: provider (google_drive or upload), id, revision
posts[]:
  post_id, platform, account_id, exact caption, schedule_at
  media[]: asset_id, sha256, public delivery url, mime_type
```

The schema is strict: unknown fields/claimed approval state are rejected. Post IDs must be unique. An asset ID cannot represent different bytes/URLs inside the same pack. Captions are preserved exactly; whitespace trimming must happen before review. Timestamps need an explicit UTC designator or offset; non-UTC offsets must match London daylight saving. Scheduling requires at least five minutes' lead time as a conservative local rule, rechecked immediately before creation.

`validateContentPack(input, { now?, requireFuture? })` returns validated data. Reads/history can use `requireFuture: false`; execution checks the selected still-pending post against the current time. `contentPackHash(pack)` hashes a canonical representation while retaining array order. The shared action core additionally binds the action and destination to its approval hash.

## Drive import

`readDriveContentPack({ fileId, expectedVersion, expectedSha256 }, { accessToken, fetch?, now? })` accepts a stored JSON/text blob and explicit server-held scoped Drive read token. It reads metadata, verifies download capability/version/size, downloads at most 512 KB, verifies the raw SHA-256, then rechecks metadata before parsing. It returns `{ pack, source: { file_id, version, sha256 } }`; the caller must include that import receipt in the artifact/audit context when used. It does not export Google Docs, follow share URLs, grant sharing or write to Drive.

A Drive file's own version is provided separately rather than embedded inside its bytes: editing a manifest to insert its latest Drive version would itself increment that version. See Google's [files.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get) and [download guide](https://developers.google.com/workspace/drive/api/guides/manage-downloads). The portal uses a dedicated read-only service account and reads only explicitly allowlisted, Viewer-shared manifest files. Access tokens refresh through Google on each request; see [portal connections](portal-connections.md). A GHL PIT token is never sent to Drive.

## Live execution settings and preflight

All settings below are server-only. Do not copy request-body values into these options:

- `OPS_CONTENT_SCHEDULING_ENABLED=true`: explicit write gate; absent/false prevents a create attempt.
- `CBB_GHL_PIT_TOKEN`: Marc sub-account token with location read, user read, social-account read, social-post read/write permissions.
- `CBB_GHL_USER_ID`: a known CRM user; membership in Marc's location is verified through the [Get User API](https://marketplace.gohighlevel.com/docs/ghl/users/get-user/).
- `OPS_CONTENT_MEDIA_HOSTS`: comma-separated exact trusted delivery hostnames, default deny. These must be operator-controlled public delivery hosts with immutable content-addressed objects and no overwrite permission for the preparation identity.

Each media URL must use HTTPS, have no credentials, IP literal, private-looking host, query or fragment, and contain the approved SHA-256 as a path component or filename. Private Drive/share links and expiring signed URLs are refused. Hostnames must match the allowlist exactly. Media downloads refuse redirects, carry no CRM token/cookies, are bounded to 20 MB per image, and verify the MIME signature plus the actual approved SHA-256. This checks the bytes at execution time; immutability of the trusted delivery store remains an operator requirement so the provider cannot later fetch changed bytes. The adapter does not make Drive source media public or provision that delivery store.

After these URL checks, preflight verifies Marc's exact location ID/name, the configured user's membership, and the destination account's location/platform/active/not-expired state. Account IDs come from the [Get Accounts API](https://marketplace.gohighlevel.com/docs/ghl/social-planner/get-account/), not OAuth IDs. Any failed preflight returns a definite failure before any create request.

## Per-post execution and recovery

`contentSchedulePreview(input, { now? })` makes no network calls.

The separate authenticated [read-only readiness check](content-readiness.md) verifies the real connection and image bytes while scheduling remains off. It returns specific per-post blockers, preserves previous outcomes, and never creates or approves anything. `verifyContentPostDelivery` supplies the shared checks used by readiness and execution.

`executeContentPost(pack, postId, options)` defaults to dry-run and makes exactly one create attempt when explicitly enabled. The action runner must already hold the exact-version approval and a persistent per-post claim; this function is an internal adapter, not an authorisation endpoint. It returns:

- `dry_run`: a plan only. Never mark the real scheduling action completed from this result.
- `scheduled`: a provider ID and receipt after matching the saved location, account, caption, date, post type and ordered media through [Get post](https://marketplace.gohighlevel.com/docs/ghl/social-planner/get-post/). Scheduled does not mean published.
- `failed`: preflight failed or a definite provider validation/auth rejection. Retrying still requires the action runner's explicit state/claim checks.
- `uncertain`: timeout, transient/server response, missing receipt, missing readback or saved-state mismatch. Preserve any provider ID and reconcile before another create attempt.

The adapter does not loop over the pack or retry creation. The shared action layer persists successes and unknown outcomes independently, so a partial pack must not recreate successful posts. New source bytes/copy/dates/accounts require a revised artifact and fresh approval, rather than mutating the approved copy.

## Verification and remaining acceptance

Targeted tests use mocked provider/Drive responses and synthetic media. They cover strict validation, dates/DST, unsafe URLs, hash/order sensitivity, zero-call defaults, wrong identity/user/account/media, exact scheduling readback, definite/uncertain results, bounded pinned Drive imports and changed-source rejection. These checks do not establish live token scopes, real platform image acceptance, approved media-host immutability, actual scheduling or future publication. Test a specifically authorised real post only after the integration and human approval are in place.
