import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createAdminClient } from "../lib/supabase/admin";
import { recordPayment } from "../lib/ops/payments";
import { updateClientSignals } from "../lib/ops/onboarding";
import { listTasks, createTask } from "../lib/ops/tasks";
import {
  getLesson,
  ingest,
  lessonAction,
  proposeCuts,
  approveCuts,
} from "../lib/ops/lessons";
import { createReportDraft, getReport, updateReport } from "../lib/ops/reports";
import { reportPeriods } from "../lib/ops/report-data";
assert.match(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  /abmmlybdqwzujcysagvf/,
);
assert.notEqual(process.env.OPS_REPORT_SEND_ENABLED, "true");
assert.notEqual(process.env.OPS_NOTIFICATIONS_ENABLED, "true");
const db = createAdminClient(),
  prefix = "reg-" + randomUUID(),
  checks: string[] = [],
  lessonIds: string[] = [],
  reportIds: string[] = [],
  taskIds: string[] = [];
const clientId = process.env.OPS_SMOKE_CLIENT_ID!,
  account = JSON.parse(
    await readFile(
      "/Volumes/CodexDev/Projects/cbb-ops-build/.test-account.json",
      "utf8",
    ),
  );
const client = await db
  .from("client_profiles")
  .select("*,users(email)")
  .eq("id", clientId)
  .single();
assert.equal(client.error, null);
assert.ok(client.data);
assert.equal(client.data.users.email, "cbb-ops-client@example.invalid");
const original = client.data,
  renderHost = process.env.RENDER_HOST_URL;
process.env.RENDER_HOST_URL = "";
const cuts = [
  {
    start_s: 0,
    end_s: 15,
    reason: "housekeeping",
    confidence: 0.99,
    snippet: "Synthetic opening",
    keep: false,
  },
];
try {
  // Late reminder delivery must still count both unique reminders in the unpaid cycle.
  const epoch = Date.now(),
    event = async (type: string, offset: number, suffix: string) =>
      recordPayment({
        event_type: type,
        contact_email: "cbb-ops-client@example.invalid",
        external_id: prefix + suffix,
        amount: 100,
        currency: "GBP",
        occurred_at: new Date(epoch + offset * 1000).toISOString(),
      });
  await event("payment_succeeded", 0, "-paid");
  await event("payment_failed", 1, "-failed");
  await event("chase_sent", 3, "-second");
  const late = await event("chase_sent", 2, "-first");
  assert.equal(late.chase_count, 2);
  assert.equal(late.payment_status, "chasing");
  const chase = await db
    .from("ops_tasks")
    .select("id")
    .eq("external_ref", `payment-chase:${clientId}:${prefix}-first`)
    .single();
  assert.equal(chase.error, null);
  await event("payment_succeeded", 4, "-cleared");
  const stale = await event("chase_sent", 2, "-stale");
  assert.equal(stale.chase_count, 0);
  assert.equal(stale.payment_status, "current");
  checks.push("out-of-order reminder count and later-payment protection");
  // Both competing forwards transitions may start from the same read; complete must win.
  await db
    .from("client_profiles")
    .update({ onboarding_stage: "invited", onboarding_completed_at: null })
    .eq("id", clientId);
  await Promise.allSettled([
    updateClientSignals(clientId, { stage: "complete" }),
    updateClientSignals(clientId, { stage: "community_added" }),
  ]);
  const onboard = await db
    .from("client_profiles")
    .select("onboarding_stage")
    .eq("id", clientId)
    .single();
  assert.ok(onboard.data);
  assert.equal(onboard.data.onboarding_stage, "complete");
  const backwards = await db.rpc("ops_update_client_signals", {
    p_client: clientId,
    p_data: { onboarding_stage: "community_added" },
    p_actor: "regression",
  });
  assert.ok(backwards.error);
  checks.push("atomic monotonic onboarding under competing updates");
  // More than one page of old closed work must not hide a new open approval.
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: randomUUID(),
    kind: "task",
    status: "done",
    title: `Synthetic closed history ${i}`,
    area: "other",
    priority: 1,
    due_at: "2000-01-01T00:00:00Z",
    external_ref: `${prefix}-history-${i}`,
    created_by: "regression",
  }));
  taskIds.push(...rows.map((r) => r.id));
  assert.equal((await db.from("ops_tasks").insert(rows)).error, null);
  assert.equal(
    (
      await db.from("ops_events").insert(
        rows.map((r) => ({
          task_id: r.id,
          actor: "regression",
          action: "fixture_seed",
          data: { status: "done" },
        })),
      )
    ).error,
    null,
  );
  const open = await createTask(
    {
      kind: "approval",
      area: "other",
      title: "Synthetic open after history",
      priority: 3,
      external_ref: prefix + "-open",
    },
    "regression",
  );
  taskIds.push(open.id);
  const all = await listTasks();
  assert.ok(all.some((t) => t.id === open.id));
  assert.ok(all.length > 1000);
  checks.push("work queue includes open approval beyond 1,000 closed rows");
  const source = await db
    .from("lesson_recordings")
    .select("source_storage_path")
    .not("source_storage_path", "is", null)
    .limit(1)
    .single();
  assert.equal(source.error, null);
  assert.ok(source.data);
  // Source renewal can run after proposing cuts, and old failures must stay retired.
  const recovery = await db
    .from("lesson_recordings")
    .insert({
      source: "fathom",
      fathom_recording_id: "999999999",
      title: prefix + " source recovery",
      status: "cuts_proposed",
      duration_s: 120,
      transcript: [],
      transcript_text: "Synthetic transcript",
      cut_list: cuts,
    })
    .select()
    .single();
  assert.equal(recovery.error, null);
  assert.ok(recovery.data);
  lessonIds.push(recovery.data.id);
  const old = await db
    .from("render_jobs")
    .insert({
      recording_id: recovery.data.id,
      job_type: "copy_source",
      status: "failed",
      cut_list: [],
      payload: { download_id: "expired" },
      created_at: new Date(Date.now() - 60000).toISOString(),
    })
    .select()
    .single();
  assert.equal(old.error, null);
  assert.ok(old.data);
  let downloads = 0;
  await ingest(recovery.data.id, {
    request: async () => {
      downloads++;
      return { download_id: "replacement", status: "processing" };
    },
  });
  assert.equal(downloads, 1);
  assert.equal((await getLesson(recovery.data.id)).status, "cuts_proposed");
  await lessonAction(recovery.data.id, { action: "retry_worker" });
  const retired = await db.rpc("ops_retry_render_job", { p_job: old.data.id });
  assert.equal(retired.error, null);
  assert.equal(retired.data.status, "failed");
  checks.push("source renewal after cut proposal preserves editing state");
  checks.push(
    "superseded failed copy does not conflict with replacement retry",
  );
  // A model response returning after approval may not rewind the recording.
  const recording = await db
    .from("lesson_recordings")
    .insert({
      source: "upload",
      title: prefix + " stale proposal",
      status: "cuts_proposed",
      duration_s: 120,
      transcript_text: "Synthetic housekeeping then teaching",
      cut_list: cuts,
      source_storage_path: source.data.source_storage_path,
    })
    .select()
    .single();
  assert.equal(recording.error, null);
  assert.ok(recording.data);
  lessonIds.push(recording.data.id);
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((r) => {
      entered = r;
    }),
    blocked = new Promise<void>((r) => {
      release = r;
    });
  const pending = proposeCuts(recording.data.id, undefined, async () => {
    entered();
    await blocked;
    return JSON.stringify({ cuts: [{ ...cuts[0], end_s: 20 }] });
  });
  await started;
  await approveCuts(recording.data.id, { cut_list: cuts });
  release();
  await assert.rejects(pending, /Recording changed/);
  assert.equal((await getLesson(recording.data.id)).status, "cuts_approved");
  checks.push("stale AI proposal rejected after cut approval");
  // An incomplete Monday snapshot refreshes on Thursday without losing human writing.
  const monday = new Date("2099-01-05T12:00:00Z"),
    period = reportPeriods(monday),
    existing = await db
      .from("ops_reports")
      .select("id")
      .eq("week_start", period.week_start)
      .maybeSingle();
  assert.equal(existing.error, null);
  assert.equal(
    existing.data,
    null,
    "Dedicated future fixture week must be unused",
  );
  const first = await createReportDraft(
    monday,
    async () => "Synthetic automatic narrative v1",
  );
  reportIds.push(first.id);
  let report = (
    await updateReport(
      first.id,
      {
        narrative_md: "Saved human narrative",
        observations_md: "Saved personal observations",
        expected_updated_at: first.updated_at,
      },
      account.id,
    )
  ).report;
  report = (
    await updateReport(
      first.id,
      { action: "review", expected_updated_at: report.updated_at },
      account.id,
    )
  ).report;
  const thursday = new Date(
      new Date(period.week_start + "T00:00:00Z").getTime() +
        3 * 86400000 +
        6 * 3600000,
    ),
    refreshed = await createReportDraft(
      thursday,
      async () => "Synthetic automatic narrative v2",
    );
  assert.equal(refreshed.id, first.id);
  assert.equal(refreshed.status, "draft");
  assert.equal(refreshed.narrative_md, "Saved human narrative");
  assert.equal(refreshed.observations_md, "Saved personal observations");
  assert.ok(refreshed.data.narrative_review_required);
  assert.equal(
    refreshed.data.periods.current.to,
    new Date(
      new Date(period.week_start + "T00:00:00Z").getTime() + 3 * 86400000,
    ).toISOString(),
  );
  checks.push(
    "Thursday refresh retains human narrative/observations and requires new review",
  );
  report = (
    await updateReport(
      first.id,
      { action: "review", expected_updated_at: refreshed.updated_at },
      account.id,
    )
  ).report;
  let sending!: () => void, finish!: () => void;
  const sendStarted = new Promise<void>((r) => {
      sending = r;
    }),
    sendBlocked = new Promise<void>((r) => {
      finish = r;
    });
  const sendPromise = updateReport(
    first.id,
    { action: "send", expected_updated_at: report.updated_at },
    account.id,
    async (snapshot) => {
      assert.equal(snapshot.narrative_md, "Saved human narrative");
      sending();
      await sendBlocked;
      return { sent: true, disabled: false };
    },
  );
  await sendStarted;
  const claimed = await getReport(first.id);
  assert.ok(claimed.send_claim_id);
  await assert.rejects(
    () =>
      updateReport(
        first.id,
        {
          narrative_md: "Unreviewed competing edit",
          expected_updated_at: claimed.updated_at,
        },
        account.id,
      ),
    /locked|changed/,
  );
  finish();
  const sent = await sendPromise;
  assert.equal(sent.report.status, "sent");
  assert.equal(sent.report.narrative_md, "Saved human narrative");
  await assert.rejects(
    () =>
      updateReport(
        first.id,
        {
          narrative_md: "Late stale save",
          expected_updated_at: sent.report.updated_at,
        },
        account.id,
      ),
    /locked|changed/,
  );
  checks.push(
    "send freezes reviewed revision; concurrent and late edits rejected (fake sender, no email)",
  );
  console.log(JSON.stringify({ pass: true, checks, externalMessages: 0 }));
} finally {
  if (renderHost === undefined) delete process.env.RENDER_HOST_URL;
  else process.env.RENDER_HOST_URL = renderHost;
  for (const id of reportIds)
    await db.from("ops_reports").delete().eq("id", id);
  for (const id of lessonIds)
    await db.from("lesson_recordings").delete().eq("id", id);
  if (taskIds.length)
    assert.equal(
      (
        await db
          .from("ops_tasks")
          .delete()
          .like("external_ref", prefix + "%")
      ).error,
      null,
    );
  await db
    .from("ops_tasks")
    .delete()
    .like("external_ref", `payment-chase:${clientId}:${prefix}%`);
  await db
    .from("client_payment_events")
    .delete()
    .like("external_id", prefix + "%");
  const fields = [
    "payment_status",
    "payment_status_updated_at",
    "payment_chase_count",
    "last_payment_at",
    "onboarding_stage",
    "onboarding_completed_at",
  ];
  await db
    .from("client_profiles")
    .update(Object.fromEntries(fields.map((k) => [k, original[k]])))
    .eq("id", clientId);
}
