import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, uuid, record } from "./tasks";
import { gatherReportData, reportPeriods } from "./report-data";
import { notifyOpsAdmins } from "./notify";
import { sendOpsReportEmail } from "@/lib/resend";
export async function listReports() {
  const r = await createAdminClient()
    .from("ops_reports")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(100);
  if (r.error) throw new OpsError(r.error.message, 503);
  return r.data;
}
export async function getReport(id: string) {
  const r = await createAdminClient()
    .from("ops_reports")
    .select("*")
    .eq("id", uuid(id))
    .maybeSingle();
  if (r.error) throw new OpsError(r.error.message, 500);
  if (!r.data) throw new OpsError("Report not found", 404);
  return r.data;
}
async function conditionalSave(
  current: { id: string; updated_at: string },
  updates: Record<string, unknown>,
) {
  const r = await createAdminClient()
    .from("ops_reports")
    .update(updates)
    .eq("id", current.id)
    .eq("updated_at", current.updated_at)
    .is("send_claim_id", null)
    .neq("status", "sent")
    .select()
    .maybeSingle();
  if (r.error) throw new OpsError(r.error.message, 409);
  if (!r.data)
    throw new OpsError(
      "Report changed or sending is in progress; reload before saving",
      409,
    );
  return r.data;
}
export async function createReportDraft(
  now = new Date(),
  options: { refresh?: boolean; expectedRevision?: string } = {},
) {
  const db = createAdminClient(),
    periods = reportPeriods(now);
  const prior = await db
    .from("ops_reports")
    .select("*")
    .eq("week_start", periods.week_start)
    .maybeSingle();
  if (prior.error) throw new OpsError(prior.error.message, 500);
  const existing = prior.data;
  if (existing) {
    if (
      options.expectedRevision &&
      existing.updated_at !== options.expectedRevision
    )
      throw new OpsError("Report changed; reload before refreshing", 409);
    if (existing.status === "sent" || existing.send_claim_id) {
      if (options.refresh)
        throw new OpsError(
          "Report is sent or sending; source refresh is locked",
          409,
        );
      return existing;
    }
    const incomplete =
      String(existing.data?.periods?.current?.to || "") < periods.current.to;
    if (!options.refresh && !incomplete) return existing;
  }
  const data = await gatherReportData(now);
  if (existing) {
    // Refresh numbers only. Codex or a person prepares the narrative separately.
    // Preserve every existing word, including text already approved by a person.
    return conditionalSave(existing, {
      data: {
        ...data,
        narrative_review_required: Boolean(existing.narrative_md?.trim()),
      },
      status: "draft",
      reviewed_by: null,
      reviewed_at: null,
    });
  }
  const created = await db
    .from("ops_reports")
    .upsert(
      {
        week_start: periods.week_start,
        status: "draft",
        data,
        narrative_md: "",
        generated_narrative_md: "",
      },
      { onConflict: "week_start", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (created.error) throw new OpsError(created.error.message, 409);
  const report =
    created.data ||
    (
      await db
        .from("ops_reports")
        .select("*")
        .eq("week_start", periods.week_start)
        .single()
    ).data;
  await notifyOpsAdmins(
    "Weekly figures ready",
    "The figures are ready for the report to be prepared.",
    `/admin/reports/${report.id}`,
    `report-draft:${report.id}`,
  );
  return report;
}
export async function updateReport(
  id: string,
  input: unknown,
  userId: string,
  send = sendOpsReportEmail,
) {
  const b = record(input),
    current = await getReport(id);
  for (const k of Object.keys(b))
    if (
      ![
        "narrative_md",
        "observations_md",
        "action",
        "expected_updated_at",
      ].includes(k)
    )
      throw new OpsError("Unsupported report field");
  if (
    typeof b.expected_updated_at !== "string" ||
    b.expected_updated_at !== current.updated_at
  )
    throw new OpsError("Report changed; reload before saving", 409);
  if (current.status === "sent" || current.send_claim_id)
    throw new OpsError("Report is sent or sending; editing is locked", 409);
  if (b.action === "refresh") {
    if (current.week_start !== reportPeriods().week_start)
      throw new OpsError(
        "Only the current week can refresh; historical snapshots are preserved",
        409,
      );
    return {
      report: await createReportDraft(new Date(), {
        refresh: true,
        expectedRevision: current.updated_at,
      }),
      refreshed: true,
    };
  }
  if (b.action === "send") {
    if (current.status !== "reviewed")
      throw new OpsError("Review the report before sending", 409);
    const claim = randomUUID(),
      db = createAdminClient();
    const claimed = await db.rpc("ops_claim_report_send", {
      p_id: uuid(id),
      p_expected: current.updated_at,
      p_claim: claim,
    });
    if (claimed.error) throw new OpsError(claimed.error.message, 409);
    let result;
    try {
      result = await send(claimed.data);
    } catch {
      throw new OpsError(
        "Report send outcome needs reconciliation; the reviewed revision remains locked",
        503,
      );
    }
    const finished = await db.rpc("ops_finish_report_send", {
      p_id: id,
      p_claim: claim,
      p_expected: claimed.data.updated_at,
      p_sent: result.sent,
    });
    if (finished.error)
      throw new OpsError(
        "Send outcome needs reconciliation; no new send was started",
        500,
      );
    if (result.sent)
      await notifyOpsAdmins(
        "Report sent",
        "The reviewed report was sent.",
        `/admin/reports/${id}`,
        `report-sent:${id}`,
      );
    return { report: finished.data, ...result };
  }
  const updates: Record<string, unknown> = {};
  for (const k of ["narrative_md", "observations_md"]) {
    if (k in b) {
      if (typeof b[k] !== "string" || (b[k] as string).length > 50000)
        throw new OpsError("Invalid report text");
      updates[k] = b[k];
    }
  }
  if (b.action && b.action !== "review")
    throw new OpsError("Unknown report action");
  if (b.action === "review") {
    if (!String(updates.narrative_md ?? current.narrative_md ?? "").trim())
      throw new OpsError("Add the report text before marking it reviewed", 409);
    updates.status = "reviewed";
    updates.reviewed_by = uuid(userId);
    updates.reviewed_at = new Date().toISOString();
    updates.data = { ...current.data, narrative_review_required: false };
  } else if (Object.keys(updates).length) {
    updates.status = "draft";
    updates.reviewed_by = null;
    updates.reviewed_at = null;
  }
  return { report: await conditionalSave(current, updates) };
}

// Codex submits prepared text against the exact source snapshot it read.
// This never marks a report reviewed and never sends it.
export async function submitReportDraft(id: string, input: unknown) {
  const b = record(input);
  if (
    Object.keys(b).some(
      (k) => !["narrative_md", "expected_updated_at"].includes(k),
    )
  )
    throw new OpsError(
      "Only prepared report text and its source revision are accepted",
    );
  if (
    typeof b.narrative_md !== "string" ||
    !b.narrative_md.trim() ||
    b.narrative_md.length > 50000
  )
    throw new OpsError(
      "Prepared report text is required (maximum 50,000 characters)",
    );
  const current = await getReport(id);
  if (
    typeof b.expected_updated_at !== "string" ||
    b.expected_updated_at !== current.updated_at
  )
    throw new OpsError(
      "Report changed; read its latest figures and text before submitting",
      409,
    );
  if (current.status !== "draft" || current.send_claim_id)
    throw new OpsError(
      "Report is already reviewed or sending; a person must reopen it before replacing the text",
      409,
    );
  if (
    current.narrative_md &&
    current.narrative_md !== current.generated_narrative_md
  )
    throw new OpsError(
      "This report has human edits; review them in the portal before replacing the text",
      409,
    );
  return conditionalSave(current, {
    narrative_md: b.narrative_md,
    generated_narrative_md: b.narrative_md,
    data: { ...current.data, narrative_review_required: true },
    status: "draft",
    reviewed_by: null,
    reviewed_at: null,
  });
}
