# Approved edited lesson → Training

Codex prepares the edited MP4, summary and workbook. Eimear reviews the finished version. The portal then adds exactly that version to the approved destination, showing a saved receipt. This implementation accepts an already uploaded private MP4; downloading a Fathom recording and copying a Drive file remain separate source/upload steps.

## Supported handoff

Use the existing private `lesson-media` bucket, under a new versioned `approved/…mp4` path. Upload with overwrite disabled. Never supply a mutable Drive share URL as the training video.

1. A verified admin calls `verifyStoredLessonMedia({storage_path, expected_sha256}, actorId)`. The server inspects the private object, streams/hashes its actual bytes, reads duration plus video/audio-track metadata, and confirms that the storage object did not change during the check. The resulting service-only verification receipt binds the SHA-256, object ID, path, size, update timestamp, etag and measured duration. A client-declared hash alone never becomes a verification receipt.
2. Submit a lesson artifact with action `publish_lesson`, destination `{module_id}`, one item key `lesson`, and the manifest below. The core artifact version and manifest version must match. Optional `source` records source provenance/hash when known; source provenance is not independently verified by this output-media check.
3. Preview and review the private video. MP4 metadata checks are not a codec decode or visual/playback review. The approving admin decides on the exact immutable artifact/hash/version, workbook and destination.
4. On execution, core first claims the artifact and `lesson` item. `publishLessonArtifact(manifest, {artifact_id, claim_id})` calls the publication transaction, which rechecks the persisted human approval, payload/version, destination, active claim, verified media identity and destination visibility.
5. One transaction creates the `lesson_recordings` and `module_content` rows, records the publication receipt and marks the `lesson` item succeeded. The caller then uses core `finishArtifact`. If a response is lost, the saved receipt is returned on replay without another lesson. A stable lesson reference also prevents a second artifact publishing the same lesson again.

`OPS_LESSON_PUBLICATION_ENABLED` defaults off. Preview/verification do not publish. Execution requires the explicit enabled setting in the tested environment. The standard path does not require the old hosted renderer or `OPS_LEGACY_LESSON_PIPELINE_ENABLED`.

## Manifest

See [the synthetic example](../fixtures/lesson-publication/manifest.example.json). It is preparation data, not an approval or a real receipt.

```json
{
  "schema_version": 1,
  "lesson_ref": "lesson:fathom-recording-id",
  "version": 1,
  "mode": "draft",
  "module_id": "verified-unpublished-module-uuid",
  "title": "Lesson title",
  "summary_md": "Reviewed summary",
  "workbook_md": "Reviewed workbook content",
  "source": { "ref": "fathom:recording-id", "sha256": null },
  "media": {
    "verification_id": "server-issued-verification-uuid",
    "storage_path": "approved/lesson-v1.mp4",
    "sha256": "actual-output-sha256"
  }
}
```

The workbook is initially inline Markdown in Training, rather than a mutable external attachment. Its exact bytes are covered by the artifact approval. A PDF attachment can be added through a later verified private-file handoff.

## Draft and publication visibility

- `mode: draft` requires an unpublished module and leaves the module private. It may add to an existing unpublished module.
- `mode: publish` requires an **empty, dedicated, unpublished module**. The transaction inserts this one lesson and publishes that module. It refuses an already published module or a module containing other drafts, so approval cannot expose unrelated work.
- Existing module assignments/access rules and private media authorization remain in force. The receipt records module publication, not a claim that every client has access.
- New lessons use the existing authenticated `/api/media/lesson/{recording_id}` playback path. Signed storage URLs are generated per authorized view and are not saved in content or receipts. New approved-path playback also rechecks the saved publication/verification identity, so replacing the stored object blocks playback under the old approval; legacy source/edited paths keep their existing behavior.
- `getVerifiedLessonMediaPreview(verificationId)` is for an admin-only redirect with private/no-store caching. It checks the current storage identity and works before or after publication. Do not expose/log its short-lived URL in JSON.
- An existing publication is not silently replaced by a later artifact. Inspect its saved receipt and use a separately designed replacement flow or existing Training administration when a published lesson needs editing.

## Media/runtime limits

The separate private-transfer implementation is now available: admin-only `POST /api/admin/ops/lesson-media/upload` issues an upload/readback grant for an immutable hash-derived path, and the knowledge repository’s `scripts/lesson_private_upload.py` handles resumable6MiB TUS chunks and full ranged byte readback up to4GiB. It verifies bucket privacy/configured size limits and never overwrites. Global account size limits still require checking. This supports the private delivery step; it does **not** raise the256MiB server/database publication verification limit or turn local receipts into approval. Root must deploy/review it and prove actual storage acceptance separately. See knowledge `docs/LESSON-PRIVATE-TRANSFER.md` for exact commands and remaining runtime/schema boundary.

The bounded verifier streams at most **256 MiB**, retains at most 8 MiB of MP4 metadata in memory, and supports ordinary non-fragmented MP4s with audio/video tracks and a positive duration no longer than eight hours. It rejects corrupt/truncated/unsupported media, a size/hash mismatch, a replaced object and a public bucket. No video buffer is copied through an upload API by this module.

Verification has a 90-second source-read timeout. Run it before claiming an approved action, in an environment whose request/runtime budget supports the file. Files above 256 MiB need a smaller approved export or a separately implemented verification path with matching server/database limits; that larger-file path is not supplied here. A long verification that fits the size bound can be moved to a controlled worker/runtime. Increasing a client-provided size/limit does not bypass this check. The finished-file playback/joins/audio review remains Eimear's decision. No representative Fathom download or large lesson was tested here.

## Check a real local edit before handing it over

When Fathom or another authorised source provides a supported direct MP4 download link, save that reference in an ignored, owner-only local JSON file. Use the actual recording reference, returned file size/expiry and expected hash when the provider supplies them:

```json
{
  "source_ref": "fathom:actual-recording-id",
  "url": "https://actual-provider-host/actual-signed-download",
  "expected_bytes": 123456789,
  "expires_at": "actual-provider-expiry-in-ISO-format"
}
```

`expected_bytes`, `expires_at` and `expected_sha256` may be omitted only when unavailable. Never fabricate them. The URL must be the actual provider download, not a recording webpage or a guessed media URL. Run:

```sh
python3 scripts/lesson-source-download.py \
  --reference work/lesson/private-download-reference.json \
  --source work/lesson/source.mp4 \
  --receipt work/lesson/source.receipt.json
```

This local-only downloader streams to a new owner-only file, keeps the signed URL out of the receipt and normal error output, checks expiry/size/hash/disk, and verifies that the complete downloaded file contains video and audio. It refuses insecure/private-address sources, redirects to another host, existing source/receipt filenames, incomplete downloads and unreadable media. A failed attempt removes only its own temporary partial file. The conservative default source limit is 4 GiB and downloads stop after thirty minutes; a larger authorised source requires an explicit local limit and enough disk. This does not raise the portal's separate edited-file limit. It needs no Fathom API key or browser-session credentials and cannot create a download link when the source has not supplied one.

Use the source-grounded cut plan and the receipt from the CBB `render_lesson.py` helper. The following command reads the untouched source, actual finished MP4, original plan, receipt and prepared materials. It hashes the actual files, checks audio/video streams and durations, verifies every receipt binding, then decodes the entire finished video and audio. It never uploads, approves or publishes. Run it from this repository and keep its output in the private lesson project's `edit/` folder:

```sh
python3 scripts/lesson-review-preflight.py \
  --source work/lesson/source.mp4 \
  --edited work/lesson/edit/lesson-v1.mp4 \
  --plan work/lesson/edit/plan.json \
  --receipt work/lesson/edit/lesson-v1.receipt.json \
  --summary work/lesson/edit/summary.md \
  --workbook work/lesson/edit/workbook.md \
  --title "The actual lesson title" \
  --output work/lesson/edit/review-v1.json
```

The new private review pack includes a clear summary of removed ranges, Eimear's checks, exact source/output hashes and explicit portal blockers. Existing files are never overwritten; the pack is written with owner-only permissions. The script rechecks source/output/plan bytes after decoding so a changing file cannot inherit an earlier check. A matching render receipt proves which cuts were requested, not that every removal was editorially appropriate. Eimear still checks the actual joins and the teaching.

`--metadata-only` is available for a quick preliminary check. Its result always says `playback_check_needed` and the portal file checks remain blocked. An edited file larger than 256 MiB can pass local playback review, but its portal handoff stays blocked. Do not lower quality silently or substitute a short sample for a full real lesson. This local pack is supporting evidence; it is not the server-issued `media.verification_id` and cannot authorise publication.

`previewLessonPublication` and `verifyStoredLessonMedia` now also return a short `review` description and remaining human steps. These fields do not change the existing approval, claim or publication gates.

## Verification evidence

- `tests/ops-lesson-publication.test.ts`: actual one-second synthetic H.264/AAC MP4 stream/hash/metadata; split stream headers; absent audio; corrupt/truncated files; wrong hash; changed object; pre-read size bound; manifest/path checks; draft preview; destination restrictions; disabled execution and private preview.
- `python3 -m unittest discover -s tests -p 'test_lesson_review_preflight.py'`: actual synthetic video/audio decoding, source preservation, tampered plan/receipt/video rejection, duration mismatch, private/no-overwrite output and explicit large-file/metadata-only blockers. Synthetic tests do not establish access to Marc's real lesson source.
- `python3 -m unittest discover -s tests -p 'test_lesson_source_download.py'`: actual MP4 validation, source/receipt file privacy, no-overwrite, expiry/size/disk/truncation/hash/redirect failures, and signed-link redaction on provider failure. HTTP responses use local fixtures; these checks are not a successful Fathom download.
- `python3 fixtures/lesson-publication/check-sql.py`: creates an isolated local PostgreSQL cluster, applies the actual 019/021/023/025 SQL with minimal baseline tables and runs transaction checks. It covers human approval, claimed item, private draft/workbook, exact-version/payload/destination guards, publication, receipt replay/no duplicate, changed object, unrelated draft protection and client privilege denial. Its owned PostgreSQL process is explicitly stopped and exit-checked.
- No production/shared database migration, real lesson publication, client message, account grant or provider write is performed by these tests.
