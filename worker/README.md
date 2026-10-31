# Lesson render worker — Railway ready, not deployed

NEEDS KEVIN: create a Railway service from `worker/`, deploy its Dockerfile, and set the portal/worker secrets. No Railway service was created by this build.

Required worker env: `RENDER_HOST_SECRET`, `OPS_API_TOKEN`, `PORTAL_BASE_URL` (exact HTTPS portal origin). Optional `FATHOM_API_KEY` for a pending Fathom download; optional `SUPABASE_SERVICE_ROLE_KEY` if upload payload omits it. On the portal: `RENDER_HOST_URL`, matching `RENDER_HOST_SECRET`, `OPS_API_TOKEN`, server Supabase service-role key and existing site URL. Use the non-live Supabase project for all previews. Keep keys out of Docker layers and logs.

Run locally with a Python virtualenv, `pip install -r requirements.txt`, then `uvicorn app:app --host 127.0.0.1 --port 8097`. Set `WORKER_ALLOW_LOCAL=true` only for loopback fixtures. Production accepts HTTPS and source/upload hosts under Supabase/Fathom; callback must match configured portal host and exact job callback path.

`GET /health` returns health only. `POST /jobs` requires `x-render-secret` and returns 202. Body: `job_id`, `job_type` (`render` default or `copy_source`), signed `source_url` or `fathom:{recording_id,download_id}`, `cut_list`, `callback_url`, `output_storage_path`, `upload:{signed_upload_url}` or `upload:{supabase:{url,service_key,bucket,path}}`. Service keys are transmitted only to the configured authenticated worker. Prefer environment injection for long-term deployments. Portal persists jobs; missing worker leaves queued with a clear message. Review page Retry queued worker re-dispatches them.

One render thread and at most three queued/running jobs bound memory/CPU. Duplicate active/done job IDs return the current receipt. The in-memory receipt cache is bounded; durable state is in portal `render_jobs`. Worker restart interrupts background jobs; operator must inspect/requeue any interrupted running job. A managed durable queue is a follow-up before high-volume/unattended production use.

Downloads stream in 1 MiB chunks to a temporary directory (8 GiB default maximum). Supabase uploads use TUS in 6 MiB chunks. No full-video memory buffering. Signed upload URLs use streaming PUT for small jobs. Fathom polling honours Retry-After and times out with a retryable failure instead of polling forever. Expired download URLs require a fresh intake/download request. Temp files are removed after success/failure.

The render computes the complement of approved cut intervals where keep=false, merges overlaps defensively, rejects all-content removal, trims video/audio and concatenates them, re-encodes H.264 CRF20 veryfast + AAC160k + faststart. Silent source videos get a silent audio track. Progress callbacks use `PATCH /api/ops/render-jobs/{id}` with bearer `OPS_API_TOKEN`, status/progress/output path/error. Errors returned to the portal do not contain signed URLs or credentials. Completed/failed callbacks cannot regress a terminal job. Render output duration is checked within 0.5 seconds before upload.

Deploy later with `railway up` only after Kevin provisions and reviews the service. Configure health check `/health`, persistent job reconciliation/alerts and disk/size budgets before production use. No deploy command was run tonight.
