import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { listTasks, OpsError } from "./tasks";
import { listArtifacts } from "./actions";
import { listPaymentCases } from "./payment-cases";
import { listReports } from "./reports";
import { automationControls } from "./artifact-execution";
import { portalActionSwitches } from "./portal-controls";
import { listWorkspaceResults } from "./workspace-results";
import { messageReplyState, checkinReplyState, routineFollowUpPaused } from "./portal-monitor";
import { isClosed, needsApproval, statusLabels } from "./workspace";
import type {
  WorkspaceCard,
  WorkspaceData,
  SourceCheck,
} from "./workspace-types";
import type { OpsArtifact } from "./action-types";
import type { OpsTask } from "./types";
import type { PaymentCase } from "./payment-policy";

type Row = Record<string, unknown> & { id: string };
const day = 86400000;
// Review prompt only. Marc/Eimear have not agreed a universal inactivity or reply SLA.
const activityReviewDays = 14;
const time = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const asText = (v: unknown) => (typeof v === "string" ? v : "");
function relation(v: unknown): Record<string, unknown> {
  return Array.isArray(v)
    ? v[0] || {}
    : v && typeof v === "object"
      ? (v as Record<string, unknown>)
      : {};
}
async function readAll(table: string, fields: string, child = false) {
  const rows: Row[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    let q = createAdminClient()
      .from(table)
      .select(fields)
      .order("id")
      .range(offset, offset + 999);
    q = child ? q.is("client.archived_at", null) : q.is("archived_at", null);
    const r = await q;
    if (r.error) throw new OpsError("Client records could not be checked", 503);
    rows.push(...(r.data as unknown as Row[]));
    if (r.data.length < 1000) return rows;
  }
  throw new OpsError("Client records exceed this check's limit", 503);
}

/** These are live projections, not a second task store. Replies and new activity
 * remove the flag on the next read; failed sources are never treated as empty. */
export function clientSignalCards(
  clients: Row[],
  messages: Row[] | null,
  checkins: Row[] | null,
  now = Date.now(),
  training: Row[] | null = [],
  lessons: Row[] | null = [],
): WorkspaceCard[] {
  const cards: WorkspaceCard[] = [];
  for (const c of clients) {
    if (c.archived_at) continue;
    const routinePaused = routineFollowUpPaused(c);
    const name =
      asText(relation(c.user).full_name) ||
      asText(c.business_name) ||
      "Unnamed client";
    const base = {
      owner: "eimear" as const,
      priority: 2,
      source: "Portal records",
      url: `/admin/clients/${c.id}`,
      history: false,
      attention: true,
    };
    if (messages !== null) {
      const latest = messages
        .filter((m) => m.client_id === c.id)
        .sort((a, b) => {
          const x = time(a.created_at),
            y = time(b.created_at);
          if (!Number.isFinite(x)) return -1;
          if (!Number.isFinite(y)) return 1;
          return y - x || b.id.localeCompare(a.id);
        })
        .slice(0, 2);
      const reply = messageReplyState(latest);
      if (reply.needs_reply !== false)
        cards.push({
          ...base,
          id: `message:${c.id}`,
          area: "inbox",
          priority: 1,
          title: `${name} · ${reply.needs_reply ? "message needs a reply" : "conversation needs checking"}`,
          detail: reply.needs_reply
            ? "The latest message is from the client. Opening it does not count as replying."
            : "The message order could not be confirmed. Check the conversation before deciding whether to reply.",
          next: "Open the client’s conversation and check the latest message.",
          state: reply.needs_reply ? "Needs a reply" : "Needs checking",
          observed_at: reply.latest_message_at,
        });
    }
    if (checkins !== null) {
      const pending = checkins.filter(
        (r) =>
          r.client_id === c.id && checkinReplyState(r).needs_reply !== false,
      );
      if (pending.length)
        cards.push({
          ...base,
          id: `checkin:${c.id}`,
          area: "engagement",
          title: `${name} · check-in needs a review`,
          state: "Needs review",
          detail: `${pending.length} check-in${pending.length === 1 ? " has" : "s have"} no confirmed final reply. A new client reply reopens the conversation.`,
          next: "Open the client’s check-ins and review the unanswered entry.",
          observed_at:
            pending
              .map((r) => asText(r.created_at))
              .sort()
              .at(-1) || null,
        });
      const observed = checkins
        .filter((r) => r.client_id === c.id)
        .map((r) => time(r.created_at));
      if (Number.isFinite(time(c.last_checkin)))
        observed.push(time(c.last_checkin));
      const last = Math.max(...observed.filter(Number.isFinite));
      if (!routinePaused && Number.isFinite(last) && now - last >= activityReviewDays * day)
        cards.push({
          ...base,
          id: `missing-checkin:${c.id}`,
          area: "engagement",
          title: `${name} · no recent check-in`,
          state: "Check in with client",
          detail: `The last recorded check-in was ${Math.floor((now - last) / day)} days ago. This meets the ${activityReviewDays}-day review threshold; confirm the client’s agreed check-in schedule before following up.`,
          next: "Check whether a check-in is expected before contacting the client.",
          observed_at: new Date(last).toISOString(),
        });
    }
    // Missing activity sources prevent a confident inactivity claim.
    if (
      routinePaused ||
      messages === null ||
      checkins === null ||
      training === null ||
      lessons === null
    )
      continue;
    const known = [
      time(c.last_login),
      time(c.last_checkin),
      ...messages
        .filter((r) => r.client_id === c.id && r.sender_role === "client")
        .map((r) => time(r.created_at)),
      ...checkins
        .filter((r) => r.client_id === c.id)
        .flatMap((r) => [time(r.created_at), time(r.client_replied_at)]),
      ...training
        .filter((r) => r.client_id === c.id)
        .flatMap((r) => [time(r.started_at), time(r.completed_at)]),
      ...lessons
        .filter((r) => r.client_id === c.id)
        .map((r) => time(r.completed_at)),
    ].filter(Number.isFinite);
    const last = Math.max(...known);
    if (Number.isFinite(last) && now - last >= activityReviewDays * day)
      cards.push({
        ...base,
        id: `activity:${c.id}`,
        area: "engagement",
        title: `${name} · portal activity has gone quiet`,
        state: "Check engagement",
        detail: `No recorded visit, message, check-in or training update in ${Math.floor((now - last) / day)} days. This meets the ${activityReviewDays}-day review threshold; check the client’s current arrangements before contacting them. These records do not show video watch time or prove lesson completion.`,
        next: "Review the client’s recent activity and decide whether support is needed.",
        observed_at: new Date(last).toISOString(),
      });
    else if (!known.length)
      cards.push({
        ...base,
        id: `activity-unknown:${c.id}`,
        area: "engagement",
        title: `${name} · activity not yet recorded`,
        state: "Not enough information",
        detail:
          "No visit, message, check-in or training date is recorded. This does not prove the client is inactive.",
        next: "Check whether this client has started and can access the portal.",
        observed_at: null,
      });
  }
  // One actionable card per client; retain each reason without flooding the worklist.
  const grouped = new Map<string, WorkspaceCard[]>();
  for (const card of cards) {
    const list = grouped.get(card.url) || [];
    list.push(card);
    grouped.set(card.url, list);
  }
  return [...grouped.values()].map((group) => {
    const first = group[0];
    return {
      ...first,
      id: `client:${first.url.split("/").at(-1)}`,
      areas: [...new Set(group.map((c) => c.area))],
      signal_ids: [...new Set(group.map((c) => c.id))],
      detail: group.map((c) => c.detail).join("\n"),
      next:
        group.length > 1
          ? `${first.next} Also review the other recorded concerns above.`
          : first.next,
    };
  });
}
export function taskCards(tasks: OpsTask[]): WorkspaceCard[] {
  return tasks.map((t) => ({
    id: `task:${t.id}`,
    task_id: t.id,
    title: t.title,
    detail: t.detail || "Open this task for its instructions and linked work.",
    next: needsApproval(t)
      ? "Review the linked work and record your decision."
      : t.status === "rejected"
        ? "Prepare the requested changes and return this for review."
        : "Open the task to assign it or record what happened.",
    owner: t.assignee,
    area: t.area,
    state: statusLabels[t.status],
    priority: t.priority,
    url: `/admin/work?task=${t.id}`,
    source:
      t.source === "human"
        ? "Added by the team"
        : t.source === "ai"
          ? "Codex"
          : "Portal",
    observed_at: t.updated_at,
    history:
      isClosed(t) ||
      (t.source === "system" && /^engagement:/.test(t.external_ref || "")),
    approval: needsApproval(t),
    attention: t.kind === "flag" || t.status === "rejected",
  }));
}
export function artifactCards(
  artifacts: OpsArtifact[],
  controls = { content_scheduling: false, lesson_publication: false },
): WorkspaceCard[] {
  return artifacts
    .filter((a) => a.status !== "superseded")
    .map((a) => ({
      id: `artifact:${a.id}`,
      title: a.title,
      detail:
        a.kind === "content"
          ? "Review the actual slides, caption and intended posting details."
          : "Review the finished video, lesson summary and workbook.",
      next:
        a.status === "draft"
          ? "Open the saved version, then approve or request changes."
          : a.status === "rejected"
            ? "Revise the work using the saved feedback. The new version needs a fresh review."
            : a.status === "approved"
              ? controls[
                  a.kind === "content"
                    ? "content_scheduling"
                    : "lesson_publication"
                ]
                ? "Approval is saved. Open the prepared work to review the separate execution step."
                : "Approval is saved. Scheduling or publication is a separate step and remains off here."
              : "Open the saved result to check what happened.",
      owner: a.status === "rejected" ? "flowstate" : "eimear",
      area: a.kind === "content" ? "content" : "lessons",
      state: {
        draft: "Needs approval",
        approved: controls[
          a.kind === "content" ? "content_scheduling" : "lesson_publication"
        ]
          ? "Approved · action pending"
          : "Approved · action off",
        rejected: "Changes requested",
        running: "In progress",
        completed: "Completed",
        needs_attention: "Needs checking",
        superseded: "Replaced",
      }[a.status],
      priority: a.status === "needs_attention" ? 1 : 2,
      url: `/admin/automation?artifact=${a.id}`,
      source: `Prepared work · version ${a.version}`,
      observed_at: a.updated_at,
      approval: a.status === "draft",
      attention: ["rejected", "needs_attention"].includes(a.status),
      history: a.status === "completed",
    }));
}
export function paymentCards(
  payments: PaymentCase[],
  remindersEnabled = false,
): WorkspaceCard[] {
  return payments.map((p) => ({
    id: `payment:${p.id}`,
    title: `${p.customer_name || "Unmatched client"} · payment ${p.state === "paid" ? "received" : "needs checking"}`,
    detail: `${p.invoice_number || p.invoice_id}. ${p.reminder_count} verified reminder${p.reminder_count === 1 ? "" : "s"}. ${p.latest_delivery ? `Latest reminder result: ${p.latest_delivery}.` : "No reminder result recorded."}`,
    next: p.reply_needs_human
      ? "The client replied. Eimear needs to review before any further reminder."
      : p.manual_pause || p.contact_dnd
        ? "Follow-up is stopped. Eimear should check the case."
        : p.reminder_count >= 2
          ? "Two reminders are recorded. Eimear takes over now."
          : remindersEnabled
            ? "Check the invoice and reminder history before any follow-up."
            : "Check the invoice and reminder history. Automatic sending remains off.",
    owner: "eimear",
    area: "payments",
    state:
      p.state === "unpaid"
        ? remindersEnabled
          ? "Unpaid"
          : "Unpaid · sending off"
        : p.state,
    priority: 1,
    url: `/admin/automation?payment=${p.id}`,
    source: "Saved payment check",
    observed_at: p.source_verified_at,
    attention: !["paid", "void", "cancelled"].includes(p.state),
    history: ["paid", "void", "cancelled"].includes(p.state),
  }));
}

export async function getWorkspace(): Promise<WorkspaceData> {
  const checked_at = new Date().toISOString();
  const checks: SourceCheck[] = [];
  async function check<T extends unknown[]>(
    key: string,
    label: string,
    read: () => Promise<T>,
  ): Promise<T | null> {
    try {
      const rows = await read();
      checks.push({ key, label, ok: true, checked_at, count: rows.length });
      return rows;
    } catch {
      checks.push({ key, label, ok: false, checked_at, count: null });
      return null;
    }
  }
  const [
    tasks,
    artifacts,
    payments,
    results,
    reports,
    clients,
    messages,
    checkins,
    training,
    lessons,
  ] = await Promise.all([
    check("tasks", "Team tasks", listTasks),
    check("artifacts", "Prepared content & lessons", listArtifacts),
    check("payments", "Saved payment cases", listPaymentCases),
    check("results", "Codex results", listWorkspaceResults),
    check("reports", "Saved reports", listReports),
    check("clients", "Client activity", () =>
      readAll(
        "client_profiles",
        "id,business_name,archived_at,payment_status,last_login,last_checkin,user:users!client_profiles_user_id_fkey(full_name)",
      ),
    ),
    check("messages", "Client messages", () =>
      readAll(
        "inbox_messages",
        "id,client_id,sender_role,created_at,client:client_profiles!inner(archived_at)",
        true,
      ),
    ),
    check("checkins", "Client check-ins", () =>
      readAll(
        "checkins",
        "id,client_id,created_at,admin_reply,replied_at,client_reply,client_replied_at,client:client_profiles!inner(archived_at)",
        true,
      ),
    ),
    check("training", "Recorded training activity", () =>
      readAll(
        "client_modules",
        "id,client_id,started_at,completed_at,client:client_profiles!inner(archived_at)",
        true,
      ),
    ),
    check("lessons", "Recorded lesson completions", () =>
      readAll(
        "content_progress",
        "id,client_id,completed_at,client:client_profiles!inner(archived_at)",
        true,
      ),
    ),
  ]);
  const paymentTaskIds = new Set(
    (payments || []).map((p) => p.task_id).filter(Boolean),
  );
  const controls = automationControls();
  const cards = [
    ...taskCards((tasks || []).filter((t) => !paymentTaskIds.has(t.id))),
    ...artifactCards(artifacts || [], controls),
    ...paymentCards(payments || [], controls.payment_reminders),
    ...clientSignalCards(
      clients || [],
      messages,
      checkins,
      Date.now(),
      training,
      lessons,
    ),
    ...(reports || []).map((r, index) => ({
      id: `report:${r.id}`,
      title: `Business report · week of ${r.week_start}`,
      detail: r.narrative_md
        ? "The saved report is ready to read. Check its period and source coverage."
        : "Figures are saved; the written review has not been added yet.",
      next: "Open the report to read the figures and prepared commentary.",
      owner: "marc" as const,
      area: "reporting" as const,
      state: r.status === "draft" ? "Draft" : r.status,
      priority: 2,
      source: "Saved report",
      observed_at: r.updated_at,
      url: `/admin/reports/${r.id}`,
      history: r.status === "sent" || index > 0,
    })),
  ].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  return {
    checked_at,
    cards,
    tasks: tasks || [],
    results: results || [],
    checks,
    controls: portalActionSwitches(),
    mode: getEnv("NEXT_PUBLIC_SUPABASE_URL")?.includes("abmmlybdqwzujcysagvf")
      ? "preview"
      : "production",
    // Scheduler state is not observable by this application; do not manufacture a live check.
    scheduler: "not_verified",
  };
}
