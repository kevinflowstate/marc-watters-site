import { createAdminClient } from "@/lib/supabase/admin";
import type { GrowthMetric } from "@/lib/growth-engine";
import { growthReportWeek } from "@/lib/growth-report-week";

type JsonObject = Record<string, unknown>;

function text(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function extractJson(value: string): JsonObject {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude did not return a JSON object");
  const parsed = JSON.parse(clean.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Claude report was not an object");
  return parsed as JsonObject;
}

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

async function generateCopy(source: JsonObject, allowProvider = true) {
  const fallback = {
    title: "Weekly Growth Engine performance update",
    executiveSummary: "The latest appointment and sales outcomes have been assembled for Flow State review.",
    strategicTakeaway: "Review lead quality and consultation outcomes before deciding the next optimisation.",
    progressUpdate: "Appointment and sales data has been updated.",
    nextPriorities: "Flow State: Review this week’s acquisition and conversion evidence.\nClient: Complete any outstanding consultation outcomes.",
  };
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || !allowProvider) return { ...fallback, generatedBy: "deterministic" as const, model: null };

  const model = process.env.GROWTH_REPORT_MODEL?.trim() || "claude-sonnet-4-6";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      system: "You are Flow State's senior growth strategist. Accuracy matters more than optimism. Never invent a metric or cause.",
      messages: [{
        role: "user",
        content: `Create a concise CBB Growth Engine weekly report draft. It will be reviewed before publication.

Return only JSON:
{"title":"string","executiveSummary":"string","strategicTakeaway":"string","progressUpdate":"one item per line","nextPriorities":"prefix each line with Flow State:, Client: or Shared:"}

Use British English. Use only the supplied evidence. If advertising-platform evidence is absent, say so rather than inferring it.

SOURCE:
${JSON.stringify(source)}`,
      }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic returned ${response.status}`);
  const body = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const raw = body.content?.filter((item) => item.type === "text").map((item) => item.text || "").join("\n") || "";
  const parsed = extractJson(raw);
  return {
    title: text(parsed.title, 140) || fallback.title,
    executiveSummary: text(parsed.executiveSummary, 4000) || fallback.executiveSummary,
    strategicTakeaway: text(parsed.strategicTakeaway, 3000) || fallback.strategicTakeaway,
    progressUpdate: text(parsed.progressUpdate, 6000) || fallback.progressUpdate,
    nextPriorities: text(parsed.nextPriorities, 6000) || fallback.nextPriorities,
    generatedBy: "ai" as const,
    model,
  };
}

export async function generateGrowthReportDraft(clientId: string, reference = new Date()) {
  const admin = createAdminClient();
  const { weekStart, weekEnd } = growthReportWeek(reference);
  const generationKey = `cbb-growth:${clientId}:${weekStart}`;

  const { data: entitlement } = await admin.from("client_entitlements")
    .select("status").eq("client_id", clientId).eq("entitlement_key", "cbb_growth_engine").maybeSingle();
  if (entitlement?.status !== "active") throw new Error("Growth Engine access is not active");

  const [{ data: profile }, { data: workspace }, { data: appointments }, { data: outcomes }] = await Promise.all([
    admin.from("client_profiles").select("id, business_name, business_type, goals").eq("id", clientId).is("archived_at", null).maybeSingle(),
    admin.from("cbb_growth_workspaces").select("id, strategy_title, strategy_summary, implementation_milestones").eq("client_id", clientId).maybeSingle(),
    admin.from("cbb_growth_appointments").select("id, appointment_status, source, starts_at")
      .eq("client_id", clientId)
      .gte("starts_at", `${weekStart}T00:00:00.000Z`)
      .lte("starts_at", `${weekEnd}T23:59:59.999Z`)
      .not("appointment_status", "in", "(deleted,cancelled,canceled)"),
    admin.from("cbb_growth_sales_outcomes").select("outcome, sale_value, updated_at")
      .eq("client_id", clientId)
      .gte("updated_at", `${weekStart}T00:00:00.000Z`)
      .lte("updated_at", `${weekEnd}T23:59:59.999Z`),
  ]);
  if (!profile) throw new Error("Active client not found");

  const now = new Date().toISOString();
  const { data: preparedWorkspace, error: workspaceError } = workspace
    ? { data: workspace, error: null }
    : await admin.from("cbb_growth_workspaces").insert({ client_id: clientId, updated_at: now }).select("id, strategy_title, strategy_summary, implementation_milestones").single();
  if (workspaceError || !preparedWorkspace) throw new Error("Growth Engine workspace could not be prepared");

  const booked = appointments?.length || 0;
  const won = (outcomes || []).filter((item) => item.outcome === "won").length;
  const lost = (outcomes || []).filter((item) => item.outcome === "lost").length;
  const followUp = (outcomes || []).filter((item) => item.outcome === "follow_up").length;
  const salesValue = (outcomes || []).filter((item) => item.outcome === "won").reduce((sum, item) => sum + Number(item.sale_value || 0), 0);
  const decided = won + lost;
  const metrics: GrowthMetric[] = [
    { label: "Appointments booked", value: String(booked) },
    { label: "New sales", value: String(won) },
    { label: "Sales value", value: money(salesValue) },
    { label: "Close rate", value: percent(won, decided), context: `${decided} decided consultation${decided === 1 ? "" : "s"}` },
    { label: "Follow-ups", value: String(followUp) },
  ];
  const source = {
    reportingPeriod: { weekStart, weekEnd },
    client: profile,
    strategy: preparedWorkspace,
    appointments: { booked, records: appointments || [] },
    salesOutcomes: { won, lost, followUp, salesValue },
    evidenceNotice: "Appointment evidence is from connected GHL events. Sales outcomes are client-submitted. Advertising data may arrive through the external draft intake.",
  };

  let generated;
  let generationError: string | null = null;
  try {
    generated = await generateCopy(source);
  } catch (error) {
    generationError = error instanceof Error ? error.message : "AI generation failed";
    generated = await generateCopy(source, false).catch(() => ({
      title: "Weekly Growth Engine performance update",
      executiveSummary: "The latest appointment and sales outcomes are ready for review.",
      strategicTakeaway: "Review the evidence before choosing the next optimisation.",
      progressUpdate: "Appointment and sales data has been updated.",
      nextPriorities: "Flow State: Review this week’s evidence.\nClient: Complete outstanding consultation outcomes.",
      generatedBy: "deterministic" as const,
      model: null,
    }));
  }

  const reportInput = {
    workspace_id: preparedWorkspace.id,
    generation_key: generationKey,
    generation_source: generated.generatedBy === "ai" ? "claude" : "deterministic",
    generation_metadata: { model: generated.model, generationError },
    title: generated.title,
    period_start: weekStart,
    period_end: weekEnd,
    executive_summary: generated.executiveSummary,
    strategic_takeaway: generated.strategicTakeaway,
    progress_update: generated.progressUpdate,
    next_priorities: generated.nextPriorities,
    metrics,
    status: "draft",
    updated_at: now,
  };
  const { data: existing } = await admin.from("cbb_growth_reports")
    .select("id, status").eq("generation_key", generationKey).maybeSingle();
  if (existing && existing.status !== "draft") {
    return { report: existing, generatedBy: generated.generatedBy, generationError, unchanged: true };
  }
  const query = existing
    ? admin.from("cbb_growth_reports").update(reportInput).eq("id", existing.id).eq("status", "draft")
    : admin.from("cbb_growth_reports").insert(reportInput);
  const { data: report, error } = await query.select("*").single();
  if (error || !report) throw new Error(error?.message || "Growth Engine draft could not be saved");

  await admin.from("cbb_growth_report_events").insert({
    report_id: report.id,
    event_type: existing ? "updated" : "created",
    metadata: { source: reportInput.generation_source, generationKey },
  });
  await admin.from("cbb_growth_connections").update({ last_draft_at: now, updated_at: now }).eq("client_id", clientId);
  return { report, generatedBy: generated.generatedBy, generationError, unchanged: false };
}
