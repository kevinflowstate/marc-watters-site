import { NextRequest, NextResponse } from "next/server";
import { generateGrowthReportDraft } from "@/lib/growth-report-generation";
import { requireGrowthManager } from "@/lib/growth-engine";

export async function POST(request: NextRequest) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const reference = typeof body?.referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.referenceDate)
    ? new Date(`${body.referenceDate}T12:00:00.000Z`)
    : new Date();
  if (!clientId) return NextResponse.json({ error: "Client is required." }, { status: 400 });
  try {
    const result = await generateGrowthReportDraft(clientId, reference);
    return NextResponse.json(result, { status: result.unchanged ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft generation failed." },
      { status: 500 },
    );
  }
}
