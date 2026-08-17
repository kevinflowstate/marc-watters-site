import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateGrowthReportDraft } from "@/lib/growth-report-generation";

function londonWeekday(reference = new Date()) {
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(reference);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: connections, error } = await admin.from("cbb_growth_connections")
    .select("client_id")
    .eq("automation_enabled", true)
    .eq("report_day", londonWeekday());
  if (error) return NextResponse.json({ error: "Connections could not be loaded." }, { status: 500 });

  const results: Array<{ clientId: string; ok: boolean; reportId?: string; error?: string }> = [];
  for (const connection of connections || []) {
    try {
      const result = await generateGrowthReportDraft(connection.client_id);
      results.push({ clientId: connection.client_id, ok: true, reportId: result.report.id });
    } catch (generationError) {
      results.push({
        clientId: connection.client_id,
        ok: false,
        error: generationError instanceof Error ? generationError.message : "Generation failed",
      });
    }
  }
  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  });
}
