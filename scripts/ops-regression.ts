import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "../lib/supabase/admin";
import { recordPayment } from "../lib/ops/payments";
import { listClientsNeedingAttention } from "../lib/ops/clients";
import { updateClientSignals } from "../lib/ops/onboarding";
import {
  listTasks,
  createTask,
  decideTask,
  completeTask,
  updateTask,
} from "../lib/ops/tasks";
import {
  getLesson,
  ingest,
  lessonAction,
  proposeCuts,
  approveCuts,
  draftLesson,
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
  taskIds: string[] = [],
  moduleIds: string[] = [];
const clientId = process.env.OPS_SMOKE_CLIENT_ID!;
const adminAccount = await db
  .from("users")
  .select("id")
  .eq("email", "cbb-ops-test@example.invalid")
  .single();
assert.ok(adminAccount.data);
const account = adminAccount.data;
const client = await db
  .from("client_profiles")
  .select("*,users!client_profiles_user_id_fkey(email)")
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
  await event("payment_paused", 8, "-newer-pause");
  await event("payment_succeeded", 6, "-late-success");
  const delayed = await db
    .from("client_profiles")
    .select("payment_status,last_payment_at")
    .eq("id", clientId)
    .single();
  assert.ok(delayed.data);
  assert.equal(delayed.data.payment_status, "paused");
  assert.equal(new Date(delayed.data.last_payment_at).getTime(), epoch + 6000);
  await event("payment_failed", 9, "-next-cycle");
  await event("chase_sent", 10, "-next-one");
  await event("chase_sent", 11, "-next-two");
  await event("chase_sent", 5, "-settled-cycle");
  const settled = await db
    .from("ops_tasks")
    .select("id")
    .eq("external_ref", `payment-chase:${clientId}:${prefix}-settled-cycle`);
  assert.equal(settled.error, null);
  assert.equal(settled.data?.length, 0);
  checks.push(
    "late success updates payment metadata without regressing status; settled-cycle reminder creates no new task",
  );

  await db
    .from("client_profiles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", clientId);
  assert.equal(
    (await listClientsNeedingAttention()).some((c) => c.id === clientId),
    false,
  );
  await db
    .from("client_profiles")
    .update({ archived_at: original.archived_at })
    .eq("id", clientId);
  checks.push("archived client is excluded from the attention tool");

  // The same timestamped events must settle identically in either arrival order.
  await event("payment_succeeded", 30, "-tie-pay-first");
  const tieA = await event("chase_sent", 30, "-tie-chase-last");
  assert.equal(tieA.payment_status, "current");
  assert.equal(tieA.chase_count, 0);
  await event("chase_sent", 40, "-tie-chase-first");
  const tieB = await event("payment_succeeded", 40, "-tie-pay-last");
  assert.equal(tieB.payment_status, "current");
  assert.equal(tieB.chase_count, 0);
  await event("subscription_cancelled", 50, "-tie-cancel-first");
  const tiedCancelled = await event(
    "payment_succeeded",
    50,
    "-tie-pay-under-cancel",
  );
  assert.equal(tiedCancelled.payment_status, "cancelled");
  await event("payment_succeeded", 60, "-tie-pay-under-cancel-first");
  const cancelLast = await event(
    "subscription_cancelled",
    60,
    "-tie-cancel-last",
  );
  assert.equal(cancelLast.payment_status, "cancelled");
  checks.push(
    "same-timestamp payment/chase and cancellation pairs use deterministic precedence in either arrival order",
  );
  const proposal = {
    kind: "approval",
    area: "other",
    title: "Synthetic revision approval",
    detail: "Original",
    external_ref: prefix + "-approval-revision",
    status: "awaiting_approval",
    links: [{ label: "Draft", url: "/fixture/original" }],
    payload: { revision: 1 },
  };
  const initialApproval = await createTask(proposal, "regression");
  taskIds.push(initialApproval.id);
  const decision = await decideTask(
    initialApproval.id,
    "approved",
    "Original approved",
    account.id,
    "regression",
  );
  const identical = await createTask(proposal, "regression");
  assert.equal(identical.status, "approved");
  assert.equal(identical.decided_at, decision.decided_at);
  assert.equal(identical.updated_at, decision.updated_at);
  const revised = await createTask(
    {
      ...proposal,
      detail: "Revised",
      links: [{ label: "Draft", url: "/fixture/revised" }],
      payload: { revision: 2 },
    },
    "regression",
  );
  assert.equal(revised.status, "awaiting_approval");
  assert.equal(revised.decided_by, null);
  assert.equal(revised.decided_at, null);
  assert.equal(revised.decision_note, null);
  await decideTask(
    revised.id,
    "rejected",
    "Revise again",
    account.id,
    "regression",
  );
  const patched = await updateTask(
    revised.id,
    { detail: "Third revision" },
    "regression",
  );
  assert.equal(patched.status, "awaiting_approval");
  assert.equal(patched.decided_at, null);
  await assert.rejects(
    () => createTask({ ...proposal, kind: "task" }, "regression"),
    /different work kind/,
  );
  checks.push(
    "identical approval retry preserves decision; revised upsert or edit clears it and reopens review",
  );
  const completion = await createTask(
    {
      kind: "task",
      area: "other",
      title: "Synthetic repeated completion",
      external_ref: prefix + "-completion",
    },
    "regression",
  );
  taskIds.push(completion.id);
  await completeTask(completion.id, "First completion", "regression");
  await db
    .from("ops_events")
    .update({ created_at: "2001-01-01T00:00:00Z" })
    .eq("task_id", completion.id)
    .contains("data", { status: "done" });
  await completeTask(completion.id, "Repeated completion", "regression");
  await updateTask(
    completion.id,
    { status: "done", detail: "Updated closed task detail" },
    "regression",
  );
  const doneEvents = await db
    .from("ops_events")
    .select("id,created_at")
    .eq("task_id", completion.id)
    .contains("data", { status: "done" });
  assert.equal(doneEvents.error, null);
  assert.equal(doneEvents.data?.length, 1);
  assert.equal(doneEvents.data?.[0].created_at, "2001-01-01T00:00:00+00:00");
  const retries = await db
    .from("ops_events")
    .select("id")
    .eq("task_id", completion.id)
    .contains("data", { status_unchanged: "done" });
  assert.equal(retries.data?.length, 2);
  checks.push(
    "completion retries retain audit but create no reportable completion in a later period",
  );
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

  const currentJob = await db
    .from("render_jobs")
    .select("id")
    .eq("recording_id", recovery.data.id)
    .eq("status", "queued")
    .single();
  assert.ok(currentJob.data);
  await db
    .from("render_jobs")
    .update({ status: "running", progress: 45 })
    .eq("id", currentJob.data.id);
  await assert.rejects(
    () => lessonAction(recovery.data.id, { action: "recover_worker" }),
    /Confirm/,
  );
  await lessonAction(recovery.data.id, {
    action: "recover_worker",
    worker_stopped: true,
  });
  const recovered = await db
    .from("render_jobs")
    .select("status,progress")
    .eq("id", currentJob.data.id)
    .single();
  assert.ok(recovered.data);
  assert.equal(recovered.data.status, "queued");
  assert.equal(recovered.data.progress, 0);
  checks.push(
    "interrupted running job only recovers with explicit stopped-worker confirmation",
  );
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
  await assert.rejects(
    () =>
      approveCuts(recording.data.id, {
        cut_list: [{ ...cuts[0], end_s: 120 }],
      }),
    /playable/,
  );
  assert.equal((await getLesson(recording.data.id)).status, "cuts_proposed");
  checks.push("all-content cut rejected before a job or approval state change");
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

  // A historical refresh must not generate or update a different current report.
  const historic = await db
    .from("ops_reports")
    .insert({
      week_start: "1999-01-04",
      status: "draft",
      data: { fixture: prefix },
      narrative_md: prefix,
    })
    .select()
    .single();
  assert.ok(historic.data);
  reportIds.push(historic.data.id);
  await assert.rejects(
    () =>
      updateReport(
        historic.data.id,
        { action: "refresh", expected_updated_at: historic.data.updated_at },
        account.id,
      ),
    /historical snapshots/,
  );
  assert.equal(
    (await getReport(historic.data.id)).updated_at,
    historic.data.updated_at,
  );
  checks.push(
    "historical refresh rejected without creating or returning another week",
  );
  const modules = await db
    .from("training_modules")
    .insert([
      { title: prefix + " draft", is_published: false },
      { title: prefix + " published", is_published: true },
    ])
    .select();
  assert.equal(modules.error, null);
  assert.equal(modules.data?.length, 2);
  const draftModule = modules.data!.find((m) => !m.is_published)!,
    publishedModule = modules.data!.find((m) => m.is_published)!;
  moduleIds.push(...modules.data!.map((m) => m.id));
  const content = await db
    .from("module_content")
    .insert({
      module_id: draftModule.id,
      title: prefix,
      content_type: "video",
      order_index: 0,
    })
    .select()
    .single();
  assert.ok(content.data);
  const moved = await db
    .from("lesson_recordings")
    .insert({
      source: "upload",
      title: prefix,
      source_storage_path: source.data.source_storage_path,
      transcript_text: "Synthetic transcript",
      status: "lesson_drafted",
      module_content_id: content.data.id,
    })
    .select()
    .single();
  assert.ok(moved.data);
  lessonIds.push(moved.data.id);
  const publishTask = await createTask(
    {
      kind: "task",
      area: "lessons",
      title: prefix,
      external_ref: `lesson-publish:${moved.data.id}`,
    },
    "regression",
  );
  taskIds.push(publishTask.id);
  assert.equal(
    (
      await db
        .from("module_content")
        .update({ module_id: publishedModule.id })
        .eq("id", content.data.id)
    ).error,
    null,
  );
  assert.equal((await getLesson(moved.data.id)).status, "published");
  await draftLesson(moved.data.id, draftModule.id);
  const replayedPublication = await db
    .from("ops_tasks")
    .select("status,links")
    .eq("id", publishTask.id)
    .single();
  assert.equal(replayedPublication.data?.status, "done");
  assert.equal(
    replayedPublication.data?.links[0].url,
    `/admin/training/${publishedModule.id}`,
  );
  checks.push(
    "replayed published draft preserves completed publication work and actual destination",
  );
  const publishedTask = await db
    .from("ops_tasks")
    .select("status,links")
    .eq("id", publishTask.id)
    .single();
  assert.ok(publishedTask.data);
  assert.equal(publishedTask.data.status, "done");
  assert.equal(
    publishedTask.data.links[0].url,
    `/admin/training/${publishedModule.id}`,
  );
  await db
    .from("module_content")
    .update({ module_id: draftModule.id })
    .eq("id", content.data.id);
  assert.equal((await getLesson(moved.data.id)).status, "lesson_drafted");
  const reopened = await db
    .from("ops_tasks")
    .select("status")
    .eq("id", publishTask.id)
    .single();
  assert.equal(reopened.data?.status, "open");
  checks.push(
    "moving a lesson both ways synchronizes publication state, task and destination link",
  );

  await db.from("module_content").delete().eq("id", content.data.id);
  const removed = await getLesson(moved.data.id);
  assert.equal(removed.module_content_id, null);
  assert.equal(removed.status, "transcribed");
  const cancelled = await db
    .from("ops_tasks")
    .select("status")
    .eq("id", publishTask.id)
    .single();
  assert.equal(cancelled.data?.status, "cancelled");
  const redrafted = await draftLesson(moved.data.id, draftModule.id);
  assert.notEqual(redrafted.module_content_id, content.data.id);
  const requeued = await db
    .from("ops_tasks")
    .select("status")
    .eq("id", publishTask.id)
    .single();
  assert.equal(requeued.data?.status, "open");
  checks.push(
    "removing a training lesson restores draft eligibility and re-drafting reopens publication work",
  );
  console.log(JSON.stringify({ pass: true, checks, externalMessages: 0 }));
} finally {
  if (renderHost === undefined) delete process.env.RENDER_HOST_URL;
  else process.env.RENDER_HOST_URL = renderHost;
  for (const id of reportIds)
    await db.from("ops_reports").delete().eq("id", id);
  for (const id of lessonIds)
    await db.from("lesson_recordings").delete().eq("id", id);
  for (const id of moduleIds)
    await db.from("training_modules").delete().eq("id", id);
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
  for (const id of lessonIds)
    await db
      .from("ops_tasks")
      .delete()
      .eq("external_ref", `lesson-publish:${id}`);
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
    "archived_at",
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
