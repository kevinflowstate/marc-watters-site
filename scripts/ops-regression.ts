// Ops regression harness for non-live test processes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "../lib/supabase/admin";
// The legacy email-based payment webhook path was removed; this harness still
// exercises the database function directly while it exists.
async function recordPayment(b: {
  event_type: string;
  external_id: string;
  contact_email: string;
  amount: number;
  currency: string;
  occurred_at: string;
}) {
  const r = await createAdminClient().rpc("ops_payment_event", {
    p_event: {
      event_type: b.event_type,
      external_id: b.external_id,
      contact_email: b.contact_email.toLowerCase(),
      contact_id: null,
      amount_pence: Math.round(b.amount * 100),
      currency: b.currency.toUpperCase(),
      occurred_at: b.occurred_at,
    },
  });
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
import { listClientsNeedingAttention } from "../lib/ops/clients";
import { updateClientSignals } from "../lib/ops/onboarding";
import {
  listTasks,
  createTask,
  decideTask,
  completeTask,
  updateTask,
  attachOutput,
} from "../lib/ops/tasks";
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
  reportIds: string[] = [],
  taskIds: string[] = [];
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
const original = client.data;
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
  const settlementA = await createTask(
    {
      kind: "task",
      area: "payments",
      title: "Synthetic tied settlement A",
      client_id: clientId,
      external_ref: prefix + "-settlement-a",
    },
    "regression",
  );
  taskIds.push(settlementA.id);
  await event("subscription_cancelled", 50, "-tie-cancel-first");
  const tiedCancelled = await event(
    "payment_succeeded",
    50,
    "-tie-pay-under-cancel",
  );
  assert.equal(tiedCancelled.payment_status, "cancelled");
  assert.equal(
    (
      await db
        .from("ops_tasks")
        .select("status")
        .eq("id", settlementA.id)
        .single()
    ).data?.status,
    "done",
  );
  const settlementB = await createTask(
    {
      kind: "task",
      area: "payments",
      title: "Synthetic tied settlement B",
      client_id: clientId,
      external_ref: prefix + "-settlement-b",
    },
    "regression",
  );
  taskIds.push(settlementB.id);
  await event("payment_succeeded", 60, "-tie-pay-under-cancel-first");
  const cancelLast = await event(
    "subscription_cancelled",
    60,
    "-tie-cancel-last",
  );
  assert.equal(cancelLast.payment_status, "cancelled");
  assert.equal(
    (
      await db
        .from("ops_tasks")
        .select("status")
        .eq("id", settlementB.id)
        .single()
    ).data?.status,
    "done",
  );
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
  const firstRevision = initialApproval.proposal_revision;
  const reassigned = await updateTask(
    initialApproval.id,
    { assignee: "marc" },
    "regression",
  );
  assert.equal(reassigned.proposal_revision, firstRevision);
  const receipted = await attachOutput(
    initialApproval.id,
    { label: "Delivery receipt", url: "/fixture/receipt" },
    "regression",
  );
  assert.equal(receipted.proposal_revision, firstRevision);
  const metadataRetry = await createTask(proposal, "regression");
  assert.equal(metadataRetry.proposal_revision, firstRevision);
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
  assert.equal(revised.proposal_revision, firstRevision + 1);
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
  assert.equal(patched.proposal_revision, revised.proposal_revision + 1);
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
  const first = await createReportDraft(monday);
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
    refreshed = await createReportDraft(thursday);
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
  console.log(JSON.stringify({ pass: true, checks, externalMessages: 0 }));
} finally {
  for (const id of reportIds)
    await db.from("ops_reports").delete().eq("id", id);
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
