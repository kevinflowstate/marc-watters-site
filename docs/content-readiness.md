# Check content before scheduling

The content path can now check the actual scheduling connection and image files while scheduling is switched off. It creates no post, saves no approval, changes no task and spends no creative/model credits. The existing Flowstate-only draft scaffold remains guarded.

## What a person sees

Each checked post has a clear result: ready, steps still needed, previously scheduled, or a previous attempt needing attention. It names the connected account when verified, shows the proposed time in London time and lists specific blockers. A successful connection check does not imply approval or permission to schedule. A previously scheduled post is not recreated. Uncertain, running and failed attempts need review before another attempt.

The prepared pack remains immutable. A new date, account, caption, image URL or image byte sequence requires a revised pack and fresh approval.

## Read-only endpoint

`POST /api/admin/ops/artifacts/{id}/preflight` requires an authenticated portal administrator. The request accepts only:

```json
{
  "version": 1,
  "manifest_hash": "the current prepared version's SHA-256",
  "post_ids": ["one-or-more-post-ids-from-that-version"]
}
```

`post_ids` is optional. Without it, the next five pending posts are checked. A supplied selection must contain one to five different IDs from the current pack. The result includes `has_more` and `remaining_post_ids`; subsequent checks can explicitly select those IDs. Dates for already successful posts do not block remaining pending posts.

The server checks the action/version/hash before reads and checks the saved version, approval and item progress again afterwards. Changed work returns a conflict rather than a stale ready response. The check has a 90-second overall request budget. Provider and media requests are restricted to GET, including when a `Request` object is supplied; it cannot fall through into a create call.

The response contains `dry_run: true`, a plain-English `summary`, `scheduling_enabled`, `approval_saved`, and a `checks` array. Each checked post includes its `post_id`, `platform`, `account_id`, `schedule_label`, `status`, `summary`, `blockers` and `connection_ready`. Successful delivery checks also return the verified account name, ordered image hashes/byte counts and a provider call plan for supporting details. This plan is not sent to the provider. No tokens or authorization headers are returned.

## What is verified

- Strict pack schema, exact captions, ordered assets and correct London/UTC schedule semantics.
- Five-minute minimum lead time, checked again after network reads.
- Marc's exact CRM location ID and business name, the configured scheduling user's membership, and the selected social account's platform, location and active/not-expired state.
- Exact approved image hosts and permanent HTTPS paths containing the selected file hash. Private Drive/share links, signed links, credentials and redirects are refused.
- Anonymous image reads without provider credentials, bounded bytes, expected image MIME/signature and the actual SHA-256 of every selected image.
- Saved approval and per-post progress independently of connection health. Actual scheduling still requires the separate enabled action and an atomic item claim.

`verifyContentPostDelivery` is shared with the existing execution adapter, so the read-only check and eventual execution use the same delivery validation. Execution still makes at most one create attempt, requires exact saved-state readback and preserves uncertain outcomes for reconciliation.

Regular LinkedIn feed posts now reject more than nine images, matching the current [HighLevel v3 create-post documentation](https://marketplace.gohighlevel.com/docs/ghl/social-planner/create-post/). Facebook/Instagram retain the conservative existing ten-image limit. This path supports image feed posts; reels, stories, video and PDF carousels need their own supported manifests and checks. A passed preflight does not prove final platform publication acceptance.

## Drive import

The existing pinned Drive import verifies metadata, version, bounded manifest bytes and raw SHA-256, then rechecks metadata. It now also rejects an empty/nonpositive source size, an incomplete download and a size change during the read. These checks use server-held scoped Drive access and do not change sharing or make a Drive file public.

## Still needed for real scheduling

The server needs Marc's scoped CRM access, a verified `CBB_GHL_USER_ID`, approved immutable image hosting in `OPS_CONTENT_MEDIA_HOSTS`, and the separate explicit scheduling gate. Readiness does not require enabling that gate. The Drive-import route separately needs its existing scoped server connection; Kevin-side or Marc-cloud connector access does not provision that server token automatically.

Read-only account checks on 6 November 2026 confirmed MRW Management LTD and three active/not-expired Facebook, Instagram and LinkedIn destinations. The existing five-slide v2 carousel still selects the correct Instagram account. Its five local 1080×1350 PNGs matched their manifest hashes in order; no new content was produced. Its exact delivery URLs all returned an anonymous HTTP 302 to preview protection. Those URLs therefore cannot yet be fetched by social platforms, even though the portal's private review mirror works. An approved public delivery location and a newly reviewed manifest are required before scheduling this draft. Do not remove preview protection or share private Drive media as a shortcut.

No live social post, draft, scheduling call, approval, sharing change or automation activation was performed for this work.
