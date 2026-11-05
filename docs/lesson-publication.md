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

The bounded verifier streams at most **256 MiB**, retains at most 8 MiB of MP4 metadata in memory, and supports ordinary non-fragmented MP4s with audio/video tracks and a positive duration no longer than eight hours. It rejects corrupt/truncated/unsupported media, a size/hash mismatch, a replaced object and a public bucket. No video buffer is copied through an upload API by this module.

Verification has a 90-second source-read timeout. Run it before claiming an approved action, in an environment whose request/runtime budget supports the file. Files above 256 MiB need a smaller approved export or a separately implemented verification path with matching server/database limits; that larger-file path is not supplied here. A long verification that fits the size bound can be moved to a controlled worker/runtime. Increasing a client-provided size/limit does not bypass this check. The finished-file playback/joins/audio review remains Eimear's decision. No representative Fathom download or large lesson was tested here.

## Verification evidence

- `tests/ops-lesson-publication.test.ts`: actual one-second synthetic H.264/AAC MP4 stream/hash/metadata; split stream headers; absent audio; corrupt/truncated files; wrong hash; changed object; pre-read size bound; manifest/path checks; draft preview; destination restrictions; disabled execution and private preview.
- `python3 fixtures/lesson-publication/check-sql.py`: creates an isolated local PostgreSQL cluster, applies the actual 019/021/023/025 SQL with minimal baseline tables and runs transaction checks. It covers human approval, claimed item, private draft/workbook, exact-version/payload/destination guards, publication, receipt replay/no duplicate, changed object, unrelated draft protection and client privilege denial. Its owned PostgreSQL process is explicitly stopped and exit-checked.
- No production/shared database migration, real lesson publication, client message, account grant or provider write is performed by these tests.
