# Canva and Social Planner foundation scaffolds

**NEEDS KEVIN:** Canva developer app registration, approved redirect URL/scopes and OAuth token storage. **NEEDS MARC:** approved brand-template IDs and confirmed text/image field names. These dependencies are recorded, not attempted. No live account registration, Canva creation or CRM write was performed.

Canva API facts verified 31 October 2026 from [Autofill](https://www.canva.dev/docs/apps/rest-apis/reference/autofills/create-design-autofill-job/), [OAuth PKCE](https://www.canva.dev/docs/apps/rest-apis/authentication/), [export](https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/) and [announcement](https://community.canva.dev/t/autofill-apis-are-now-available-on-canva-pro-and-above/8922). Current docs list Pro (including Education/Nonprofits), Teams and Enterprise. Announcement is dated **23 September 2026**, correcting 21 September in the plan. App mode/permissions still need confirmation; plan eligibility does not register an integration.

`lib/ops/canva.ts`: PKCE authorization URL/session and state-checked token exchange; text and image field validation against `GET /brand-templates/{id}/dataset`; `POST /autofills`, poll `GET /autofills/{jobId}`, then `POST /exports` with PNG format and poll `GET /exports/{jobId}`. Canva image fields use existing `asset_id`, not a raw URL. Export URLs are ordered by page and expire in 24 hours. Preserve/export files to the approved durable asset store before scheduling. Store PKCE verifier/state server-side for at most 10 minutes; never print verifier, client secret or tokens.

```sh
node scripts/canva-autofill.mjs fixtures/creative/canva.json
node scripts/social-draft.mjs fixtures/creative/social.json
```

Both default to dry-run and need no secrets. Execute paths are scaffolded for a later authorised setup, not run in this build. Canva uses `CANVA_ACCESS_TOKEN` only server-side; Social Planner uses `FLOWSTATE_SOCIAL_TOKEN`. Those optional local CLI variables are not browser env vars and were not registered on production.

Social request shape follows the proven 16 October Flowstate content pipeline: ordered `media` array, caption in `summary`, `status=draft`, `type=post`, account IDs, user ID, Facebook/Instagram post details; **no scheduleDate**. The module only permits Flowstate test location `G8y4IyfApuOFkG9QgYGv`, verifies the live name `Flowstate Marketing`, checks each connected active/unexpired account and reads the saved post back as a draft. Marc’s live location is explicitly refused. This build exercises only dry-run payloads; no draft was written anywhere.

Execute CLI paths create exclusive attempt files before mutations and save receipts. An ambiguous result must be reconciled by the returned job/post ID before any creation retry. Do not delete an attempt file merely to rerun. The scaffolds do not schedule or publish and do not register any connector. Production enablement requires a separate account/approval review.
