# Portal connections

The portal reads the business sources and shows work for review. Saving a connection does not turn on sending, scheduling or publication. Keep all six action flags false while testing.

## GHL

Preview-only server secrets: `CBB_GHL_PIT_TOKEN` and `CBB_GHL_USER_ID`. `GHL_LOCATION_TOKEN` supplies the same verified location credential to private report reads. The token comes from the approved local client credential store, never GitHub or a browser bundle.

The connection check verifies location `93GJEdsr0cT9el3OINXq` / `MRW Management LTD`, then checks the selected user's membership and reads the connected social accounts. The current verified user is Marc Watters (`aNIzeeSJlRe6eO20CWBC`). No messages or social posts are created by these checks. Social-account readiness and image-delivery readiness are separate.

## Drive

Use a dedicated Google service account with **no project roles and no domain-wide delegation**. Marc's Codex connector can grant **Viewer** permission to individual files; it cannot share folders. Keep the parent folder and Business Hub private. Do not export a Codex connector token.

Server-only settings:

- `OPS_CONTENT_DRIVE_SERVICE_ACCOUNT_JSON`: the private JSON credential, stored as a sensitive preview-branch secret.
- `OPS_CONTENT_DRIVE_FILE_IDS`: exact allowed manifest IDs, comma-separated (maximum20). Current handoff: `1sNng2yyCvDY9VZWi_9WnF0l-8a3vgo9P`.

The handoff file lives at **CBB Business Hub → 04 Weekly Content → portal-content-pack.json**. Its parent remains private. Google omits parent metadata when the service account has access only to the file, so the server checks an explicit file-ID allowlist, not an inferred folder path. Any other file is refused before a request, even if someone shares extra material with the identity.

`connectContentDrive` signs a short-lived assertion for Google's fixed token endpoint with `drive.readonly` scope. Each check/import obtains a fresh access token: no hourly pasted token or browser session is needed. No impersonated user is requested. Revoked credentials fail closed. The current public certificate expires6November2027; replace it before then through the approved credential store and preview/production secret rotation process.

The import route checks file permission/type before and after reading the exact Drive version and SHA-256. It saves an unapproved draft and a separate source receipt. It does not schedule content. A successful file read alone is not proof of a completed import.

For the next pack, Codex archives the previous prepared source privately, then updates the **same handoff file ID** using Drive `update_file` with `file_uri`. It reads back the new bytes and numeric version (the portal reader can retrieve the version if the connector omits it). A changed source requires a revised portal artifact and new approval. Do not create a new shared file every week or widen the allowlist automatically. Original exports stay in their existing private folders; this connection does not make images publicly downloadable for social platforms.

## Read-only verification

Signed-in admins can GET `/api/admin/ops/connections`. It returns independent GHL and Drive results plus the action-switch state. It never returns tokens, keys, raw provider errors, or creates business records. Google authentication uses POST; provider data reads use GET.

Acceptance: correct GHL location/user, available Facebook/Instagram accounts, allowlisted Drive file readable, a real manifest imported and source receipt verified, all action flags false. Public image hosting and explicit exact-version approval are still required before social scheduling can be enabled.

## Workspace connection checks

The workspace’s **Connections & next steps** section runs this read-only check on demand. Opening or refreshing the normal workspace does not poll the external providers. CRM and Drive results are separate; one failed source does not hide the other. A new check clears the old result, and failed/session/timeout checks cannot leave a previous green result on screen. Account names and clear next steps are shown without internal identifiers or provider diagnostics.

The content section links to Prepared work, where the exact post’s media, date, destination and saved approval must be checked. A configured image host is not presented as tested image delivery. Payment-template/delivery validation, Fathom video access and the actual Codex scheduler remain explicitly outside this connection check.

The workspace now displays all six raw action switches, including portal sending. This is intentionally separate from the execution adapter’s prerequisite checks: an enabled scheduling switch must remain visible even if missing credentials or image hosting prevent execution. A missing field means unknown, never “Off”. No toggle, activation or provider-write control is added.

Reference: [Google service account authentication](https://developers.google.com/identity/protocols/oauth2/service-account) and [sharing specific files with a service account](https://developers.google.com/workspace/guides/create-credentials).
