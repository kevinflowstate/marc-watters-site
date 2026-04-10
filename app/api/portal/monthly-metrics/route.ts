import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentMetricsMonthStart,
  normalizeMonthlyMetricsHistory,
  monthlyMetricDefinitions,
  monthlyMetricKeySet,
} from "@/lib/monthly-metrics";
import type { ClientMonthlyMetric, MonthlyMetricKey } from "@/lib/types";
import { NextResponse } from "next/server";

function normalizeMetricValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function normalizeMetricsPayload(value: unknown): Partial<Record<MonthlyMetricKey, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const next: Partial<Record<MonthlyMetricKey, number>> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!monthlyMetricKeySet.has(key as MonthlyMetricKey)) continue;
    const normalized = normalizeMetricValue(rawValue);
    if (normalized === null) continue;
    next[key as MonthlyMetricKey] = normalized;
  }

  return next;
}

function validateMetrics(values: Partial<Record<MonthlyMetricKey, number>>) {
  for (const metric of monthlyMetricDefinitions) {
    const value = values[metric.key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      return `Please enter ${metric.label.toLowerCase()}.`;
    }

    if (typeof metric.min === "number" && value < metric.min) {
      return `${metric.label} cannot be below ${metric.min}.`;
    }

    if (typeof metric.max === "number" && value > metric.max) {
      return `${metric.label} cannot be above ${metric.max}.`;
    }
  }

  return null;
}

async function getClientProfileId(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  return profile?.id || null;
}

async function getMetricsHistory(clientId: string): Promise<ClientMonthlyMetric[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_monthly_metrics")
    .select(
      "id, client_id, month_start, monthly_revenue, gross_profit_margin, lead_conversion_rate, average_job_value, pipeline_forward_book, submitted_at, updated_at",
    )
    .eq("client_id", clientId)
    .order("month_start", { ascending: true });

  return normalizeMonthlyMetricsHistory(data || []);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clientId = await getClientProfileId(user.id);
  if (!clientId) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const currentMonthStart = getCurrentMetricsMonthStart();
  const history = await getMetricsHistory(clientId);

  return NextResponse.json({
    history,
    currentMonthStart,
    currentMonthSubmitted: history.some((entry) => entry.month_start === currentMonthStart),
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clientId = await getClientProfileId(user.id);
  if (!clientId) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const values = normalizeMetricsPayload(payload.values);
  const validationError = validateMetrics(values);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const admin = createAdminClient();
  const currentMonthStart = getCurrentMetricsMonthStart();
  const timestamp = new Date().toISOString();

  const { data: existing } = await admin
    .from("client_monthly_metrics")
    .select("submitted_at")
    .eq("client_id", clientId)
    .eq("month_start", currentMonthStart)
    .maybeSingle();

  const { error } = await admin.from("client_monthly_metrics").upsert(
    {
      client_id: clientId,
      month_start: currentMonthStart,
      monthly_revenue: values.monthly_revenue,
      gross_profit_margin: values.gross_profit_margin,
      lead_conversion_rate: values.lead_conversion_rate,
      average_job_value: values.average_job_value,
      pipeline_forward_book: values.pipeline_forward_book,
      submitted_at: existing?.submitted_at || timestamp,
      updated_at: timestamp,
    },
    { onConflict: "client_id,month_start" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const history = await getMetricsHistory(clientId);

  return NextResponse.json({
    success: true,
    history,
    currentMonthStart,
    submitted_at: existing?.submitted_at || timestamp,
    updated_at: timestamp,
  });
}
