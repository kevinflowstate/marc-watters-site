# CBB Growth Engine automation

The Growth Engine accepts weekly report drafts from Claude, Make, n8n, a scheduled job, or another trusted service. Intake never publishes automatically.

## Report workflow

1. The client must be enrolled in CBB Growth Engine.
2. The automation submits a report to `POST /api/integrations/growth-engine/report-drafts`.
3. The endpoint maps the client using `clientId` or the configured `ghlLocationId`.
4. The report and optional files are stored privately as a retry-safe draft.
5. A Flow State operator reviews the draft and each file’s visibility.
6. Publishing releases the report and files marked for the client, then creates one in-app notification and one push attempt.
7. Withdrawing the report hides the report and all linked files.

## Authentication

Set `GROWTH_ENGINE_INGEST_SECRET` in the deployment environment and send it using either:

```http
Authorization: Bearer <secret>
```

or:

```http
x-growth-engine-secret: <secret>
```

Do not put the secret in browser code, a public repository, or a client-side GHL workflow.

## JSON intake

JSON is useful when the automation already has a base64-encoded PDF or CSV.

```json
{
  "ghlLocationId": "location-id",
  "sourceKey": "claude-report:2026-08-03",
  "source": "claude-weekly-report",
  "title": "Qualified demand improved this week",
  "periodStart": "2026-07-27",
  "periodEnd": "2026-08-02",
  "executiveSummary": "Lead quality improved while booked appointments held.",
  "strategicTakeaway": "Keep the current offer and improve speed to lead.",
  "progressUpdate": "New creative launched\nMissed-call follow-up enabled",
  "nextPriorities": "Flow State: Review lead-source quality\nClient: Complete consultation outcomes",
  "metrics": [
    { "label": "Cost per lead", "value": "£18.40", "change": "-12%" },
    { "label": "Appointments booked", "value": "12" },
    { "label": "New sales", "value": "3" }
  ],
  "attachments": [
    {
      "fileName": "weekly-performance.pdf",
      "title": "Weekly performance report",
      "visibility": "client",
      "base64": "<base64 data>"
    }
  ]
}
```

`visibility: "client"` means the file remains private while the report is a draft and is released when the report is published. Use `"internal"` for operator-only evidence.

## Direct signed upload

Use the signed-upload flow for larger files so the report automation does not send binary data through the portal function.

1. Request a one-file upload URL:

```json
POST /api/integrations/growth-engine/uploads
{
  "ghlLocationId": "location-id",
  "sourceKey": "claude-report:2026-08-03",
  "fileName": "weekly-performance.pdf",
  "title": "Weekly performance report",
  "sizeBytes": 2483120,
  "visibility": "client"
}
```

2. Upload the file to the returned Supabase `signedUrl` using the returned `token`. The Supabase SDK method is `storage.from(bucket).uploadToSignedUrl(path, token, file)`.
3. Submit the report JSON with the returned attachment object:

```json
{
  "sourceKey": "claude-report:2026-08-03",
  "title": "Qualified demand improved this week",
  "attachments": [{
    "uploadedPath": "internal/<client>/automation/<source>/staged/<file>.pdf",
    "fileName": "weekly-performance.pdf",
    "title": "Weekly performance report",
    "visibility": "client"
  }]
}
```

The final intake verifies the staged path belongs to the same client and `sourceKey`, checks the real file signature, moves it into retry-safe private storage and removes the staging object.

## Multipart intake

Multipart is preferred when the automation has real files:

```bash
curl -X POST "https://<portal-host>/api/integrations/growth-engine/report-drafts" \
  -H "Authorization: Bearer $GROWTH_ENGINE_INGEST_SECRET" \
  -F 'payload={
    "clientId":"<client-profile-id>",
    "sourceKey":"claude-report:2026-08-03",
    "source":"claude-weekly-report",
    "title":"Qualified demand improved this week",
    "periodStart":"2026-07-27",
    "periodEnd":"2026-08-02",
    "attachments":[
      {"fileName":"weekly-performance.pdf","title":"Weekly performance report","visibility":"client"},
      {"fileName":"campaign-export.csv","title":"Campaign export","visibility":"internal"}
    ]
  };type=application/json' \
  -F "files=@weekly-performance.pdf;type=application/pdf" \
  -F "files=@campaign-export.csv;type=text/csv"
```

## Retry behaviour

- `sourceKey` is required and should uniquely identify one client reporting period.
- Repeating the same request updates the existing private draft.
- Repeating the same files does not create duplicate assets.
- Replacing the attachment list removes stale automation files for that source.
- A published or withdrawn report cannot be overwritten by the integration.

## GHL and scheduled drafts

- GHL appointment events arrive through `/api/webhooks/ghl/growth-engine` after a client’s location and optional calendar IDs are configured.
- Clients record won, lost, follow-up and no-show outcomes inside Growth Engine.
- `/api/cron/growth-engine-reports` generates an evidence-based draft on the configured reporting day.
- External intake can supplement or replace that draft with advertising-platform metrics and a generated PDF.

All routes require an active Growth Engine entitlement. Existing CBB clients remain locked until explicitly enrolled.
