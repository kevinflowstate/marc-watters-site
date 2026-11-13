# Brief - weekly video content scheduler (Codex, 13 Nov 2026)

Owner: Kevin. Reviewer in the portal: Eimear (role `admin`). Written by Claude 12 Nov 2026 from live checks.

## Goal

Marc's videographer drops the week's videos into a Google Drive folder every Tuesday. The portal picks them up and shows each one at `/admin/content` with:
- the video, playable;
- the caption, editable;
- a suggested posting date, editable;
- the platforms it will go to.

Eimear presses **Approve** and it is scheduled to Marc's Instagram, Facebook and LinkedIn through the CRM Social Planner. Nothing posts without that click.

## What Marc does today (read from the CRM, 12 Nov)

These defaults copy what Marc already does by hand, so nothing changes for his audience.

- **Volume:** one video a day, 7 a week, weekends included.
- **Time:** almost always 18:00 Europe/London. Older posts were sometimes at 17:00, 19:00 or 21:00.
- **Platforms:** each video is posted three times, one post per account:
  - Instagram as a `reel`;
  - Facebook as a `reel` (recent ones as a `post`);
  - LinkedIn as a `post`.
- **Video hosting:** videos are uploaded to the CRM's own media library (`files.leadconnectorhq.com`, older ones `assets.cdn.filesafe.space`). The post's `media[].url` points there with `type: "video/mp4"`.
- **Captions:**
  - they open with a bold title in Unicode maths-bold characters (for example "𝗧𝘂𝗿𝗻𝗼𝘃𝗲𝗿 𝗨𝗽, 𝗕𝘂𝘁 𝗬𝗼𝘂𝗿 𝗟𝗶𝗳𝗲 𝗚𝗼𝘁 𝗪𝗼𝗿𝘀𝗲?"), then the body;
  - they are written in the composer today;
  - the same caption goes on all three platforms.
- **Google posts:** some scheduled posts show platform `google`, but the accounts endpoint lists only three accounts (FB page, IG profile, LinkedIn profile). Leave Google out; add it later only if Kevin asks.

Accounts (from `GET /social-media-posting/93GJEdsr0cT9el3OINXq/accounts`). All three are active and expire 11 Jan 2027.

| Platform | Account id |
|---|---|
| Facebook page | `68ecdf2f67c85a738c2185d7_93GJEdsr0cT9el3OINXq_492149980637437_page` |
| Instagram | `68ecdf6168d1a97df3549f82_93GJEdsr0cT9el3OINXq_17841466342364869` |
| LinkedIn | `68ece05ddf4604866967695e_93GJEdsr0cT9el3OINXq_7WYR__7Ivy_profile` |

Read these at runtime from the accounts endpoint. Don't hard-code them, so a reconnect doesn't break posting. Flag an account that is expired or within 14 days of expiry as a banner on the page.

## What already exists - reuse it, don't rebuild

| Piece | Where | Use |
|---|---|---|
| Drive service account (read) | `lib/ops/drive-connection.ts`, env `OPS_CONTENT_DRIVE_SERVICE_ACCOUNT_JSON` (set in production). Account: `cbb-portal-drive-reader@flowstate-ai-486508.iam.gserviceaccount.com` | List and download the inbox folder |
| Scheduler key and user | env `CBB_GHL_PIT_TOKEN`, `CBB_GHL_USER_ID` (both set in production) | Upload media, create and read posts |
| Kill switch | env `OPS_CONTENT_SCHEDULING_ENABLED` (set in production; confirm its value, never flip it yourself) | Gate every write to the CRM |
| Guarded create | `executeContentPost` in `lib/ops/content-scheduling.ts`: a single create attempt, then a readback check, a receipt, and an "uncertain" outcome that is never retried blindly | Follow the same pattern for video posts |
| Pack schema | `lib/ops/content-pack.ts` (images only, `type: "post"` only) | Extend it, or write a sibling video schema. Don't loosen the image path |
| Tasks | `lib/ops/tasks.ts` | One task for Eimear: "N new videos to review" |
| UI standard | `flat-admin-ui` skill, `ws-*` classes, `app/restyle.css` | Page, rows and drawer |

## Data flow

0. **First, map the real folder (read only).** Kevin has no access to the folder; Marc's Codex does. Before writing the intake code:
   - get the tree under "Killen Studios Folder" from Marc's Codex, or from the service account once the folder is shared: folder names, file names, mime types, and how the captions are stored;
   - save it as `docs/briefs/killen-studios-layout.md`, with names only and no file contents;
   - build the walker and caption matcher to fit that layout, not the guesses in this brief.

1. **Intake.** A cron at `/api/cron/content-intake` runs hourly, 08:00-22:00 London. A "Check for new videos" button on the page calls the same code. It:
   - walks the folder tree under `OPS_CONTENT_INBOX_FOLDER_ID`, which is the root "Killen Studios Folder":
     - root > one folder per month > subfolders such as content and captions (exact names to be confirmed, see step 0 below);
     - it only walks the current month's folder and next month's, so old months are never re-imported;
     - month folders are matched by name (for example "November 2026", "Nov 26" or "2026-11"), so the parser must accept every format the folder actually uses;
   - lists the video files in those folders (`mimeType contains 'video/'`, not trashed);
   - inserts any `drive_file_id` not already in `content_videos`, with status `new`;
   - de-duplicates on `drive_file_id`. A different `md5Checksum` on the same id means the videographer replaced the file: mark the row `replaced` and re-import, but only while it is still unscheduled.
2. **Import.** One video per invocation, with `maxDuration` 300. It:
   - streams the file from Drive and uploads it to the CRM media library (`POST /medias/upload-file`, multipart, location `93GJEdsr0cT9el3OINXq`);
   - saves the returned URL and file id;
   - moves the row to `ready`, or to `failed` with the reason;
   - caps the size at `OPS_CONTENT_VIDEO_MAX_MB` (default 500), and confirm the media library's real video limit before choosing that default;
   - generates no thumbnail; the player uses `preload="metadata"`.
3. **Caption.** Taken in this order:
   1. a caption from the month's captions subfolder, matched to the video. How they match depends on what step 0 finds: one Doc per video with the same base name, or one Doc listing several captions under video names or numbers. Build the matcher for the real layout, and record unmatched captions as a warning on the page;
   2. otherwise blank, with "Caption needed" on the card.

   No AI caption in this build (see Open items).
4. **Suggested date.** The next free 18:00 London slot, starting tomorrow. A slot is taken if:
   - any scheduled CRM post already sits on that date (read `posts/list` with type `scheduled` for the next 28 days); or
   - another `content_videos` row has already claimed it.

   Assign slots in the videographer's file order, by name then created time. Store the time in UTC and show it in London time.
5. **Review** (`/admin/content`, admin only). Videos are grouped as To review, Scheduled and Done. Each row opens a drawer with:
   - a 9:16 `<video controls playsinline>` player using the CRM media URL;
   - the caption in a textarea, with a character count and a warning above the limits (Instagram 2,200, LinkedIn 3,000);
   - a date and time picker;
   - three platform checkboxes, all on by default;
   - **Approve and schedule**, **Skip** and **Open in Drive** buttons.
6. **Approve.** For each ticked platform, make one create call with:
   - `type` = `reel` for Instagram and Facebook, `post` for LinkedIn;
   - `status: "scheduled"`, `scheduleDate`, and the same caption and media URL.

   Then read each post back, as `executeContentPost` does, and store one receipt per platform. If some platforms succeed and some fail, keep the successes and show "Scheduled on Instagram and LinkedIn; Facebook failed - Retry Facebook". Never mark the whole row failed after a post has landed. A 5xx or timeout is `uncertain`: reconcile by listing posts for that date before offering a retry.
7. **After scheduling.** The row moves to Scheduled with links to the CRM posts. Rescheduling and unscheduling are phase 2: edit in the CRM for now, and the page shows a note saying so.

## Schema (new migration)

```sql
create table content_videos (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  drive_md5 text,
  file_name text not null,
  size_bytes bigint,
  status text not null default 'new'
    check (status in ('new','importing','ready','failed','scheduled','partly_scheduled','skipped','replaced')),
  failure_reason text,
  media_url text,              -- CRM media library URL
  media_file_id text,
  caption text not null default '',
  caption_source text check (caption_source in ('sidecar','manual')),
  suggested_at timestamptz,
  schedule_at timestamptz,     -- what was approved
  platforms text[] not null default '{instagram,facebook,linkedin}',
  approved_by uuid references users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table content_video_posts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references content_videos(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','linkedin')),
  account_id text not null,
  outcome text not null check (outcome in ('claimed','scheduled','failed','uncertain')),
  provider_post_id text,
  receipt jsonb,
  reason text,
  created_at timestamptz not null default now(),
  unique (video_id, platform)
);
```

- Turn RLS on with no policies: service role only, and the admin API routes check `role = 'admin'`.
- The `unique (video_id, platform)` constraint is the double-click guard. Insert `claimed` first, then call the CRM.

## Files

- `supabase/migrations/2026111312xxxx_content_videos.sql`
- `lib/content/intake.ts` - Drive list and diff
- `lib/content/import.ts` - Drive to CRM media upload
- `lib/content/slots.ts` - next free 18:00 (pure function, unit tested)
- `lib/content/schedule.ts` - one guarded create per platform, readback, receipts
- `app/api/cron/content-intake/route.ts` - `CRON_SECRET` auth, the same as the other crons
- `app/api/admin/content/route.ts` (list, check now), `app/api/admin/content/[id]/route.ts` (edit caption, date, platforms; skip), `app/api/admin/content/[id]/approve/route.ts`
- `app/admin/content/page.tsx` and its drawer, plus a nav entry "Content" in `components/admin/admin-nav.tsx`
- `vercel.json` - add the intake cron
- `tests/content-*.test.ts` - slots, de-duplication, partial success, uncertain handling, payload shape per platform

New env:
- `OPS_CONTENT_INBOX_FOLDER_ID`
- `OPS_CONTENT_VIDEO_MAX_MB` (optional)
- `OPS_CONTENT_POST_TIME` (default `18:00`)

## Guardrails

- Every CRM write sits behind `OPS_CONTENT_SCHEDULING_ENABLED === "true"`. While it is off:
  - Approve shows "Scheduling is switched off" and writes nothing;
  - the media upload is also off.
- No test posts on Marc's live accounts. For acceptance, create one post with `status: "draft"` on a single account, read it back, and leave it for Kevin to see. The first real scheduled post needs Kevin's explicit go-ahead.
- Never delete CRM posts or media from code.
- Never write to the videographer's Drive folder (read scope only).
- Trim env values (`.trim()`). Don't log the key or the full media URL with its query string.

## Acceptance

1. With the folder shared and the env set, "Check for new videos" lists the Tuesday files once each, and a second run adds nothing.
2. Each video plays in the drawer on desktop and on a phone, in dark and light themes.
3. The suggested dates fill the next free 18:00 slots, skipping days that already have a scheduled CRM post.
4. Approve with scheduling off writes nothing. With it on (Kevin's go), you get three CRM posts with the right types, caption, time and media, and the receipts are stored.
5. Type check, lint, tests and the build all pass. Send screenshots at 1440 and 390 to Kevin before merging.

## Open items (Kevin or Marc)

1. **Drive folder.** The root is "Killen Studios Folder" in Marc's own Google Drive, with month folders and then content and captions subfolders inside. Kevin has no access; Marc's Codex does.
   - Marc, or Marc's Codex, shares the root folder, as Viewer, with `cbb-portal-drive-reader@flowstate-ai-486508.iam.gserviceaccount.com`. Sharing the root covers future month folders too.
   - Then set its id in `OPS_CONTENT_INBOX_FOLDER_ID`.
   - Once the folder is shared, the service account can find the id itself by searching for "Killen Studios Folder".
2. **Captions.** Does the videographer, Eimear or Marc write them? If nobody supplies them with the video, the option is AI-drafted captions in Marc's style, using his ~60 past captions as examples and a transcript of the video (roughly 1-3p per video). Not in this build unless Kevin says so.
3. **Token scope.** Confirm `CBB_GHL_PIT_TOKEN` has the medias write and social posting write scopes, with a read-only call where possible.
