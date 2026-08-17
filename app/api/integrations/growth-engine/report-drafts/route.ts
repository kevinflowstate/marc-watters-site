import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanReportInput } from "@/lib/growth-engine";
import {
  automationAssetsFromMetadata,
  automationStoragePath,
  automationStoragePrefix,
  GROWTH_ENGINE_AUTOMATION_MAX_TOTAL_SIZE,
  parseAutomationIntakeRequest,
  prepareAutomationAttachment,
  withAutomationAssets,
} from "@/lib/growth-engine-automation";

const BUCKET = "cbb-growth-engine";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const configured = process.env.GROWTH_ENGINE_INGEST_SECRET?.trim() || "";
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const supplied = request.headers.get("x-growth-engine-secret")?.trim() || bearer;
  if (!configured || !supplied || !safeEqual(configured, supplied)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = await parseAutomationIntakeRequest(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid automated report payload." },
      { status: 400 },
    );
  }
  const body = parsed.payload;
  const input = cleanReportInput(body);
  const requestedClientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const locationId = typeof body?.ghlLocationId === "string" ? body.ghlLocationId.trim() : "";
  const sourceKey = typeof body?.sourceKey === "string" ? body.sourceKey.trim().slice(0, 160) : "";
  if ((!requestedClientId && !locationId) || !input.title || !sourceKey) {
    return NextResponse.json({ error: "Client mapping, sourceKey and report title are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  let clientId = requestedClientId;
  if (!clientId) {
    const { data: connection } = await admin.from("cbb_growth_connections")
      .select("client_id").eq("ghl_location_id", locationId).maybeSingle();
    clientId = connection?.client_id || "";
  }
  if (!clientId) return NextResponse.json({ error: "Growth Engine client could not be mapped." }, { status: 404 });

  const [{ data: entitlement }, { data: client }] = await Promise.all([
    admin.from("client_entitlements")
      .select("status").eq("client_id", clientId).eq("entitlement_key", "cbb_growth_engine").maybeSingle(),
    admin.from("client_profiles").select("id").eq("id", clientId).is("archived_at", null).maybeSingle(),
  ]);
  if (!client || entitlement?.status !== "active") {
    return NextResponse.json({ error: "Growth Engine access is not active." }, { status: 409 });
  }

  const intakeAttachments = [...parsed.attachments];
  const stagedPaths: string[] = [];
  const expectedStagingPrefix = `${automationStoragePrefix(clientId, sourceKey)}/staged/`;
  for (const staged of parsed.stagedAttachments) {
    if (!staged.uploadedPath.startsWith(expectedStagingPrefix)) {
      return NextResponse.json({ error: "A staged file does not belong to this report source." }, { status: 400 });
    }
    const { data: downloaded, error: downloadError } = await admin.storage.from(BUCKET).download(staged.uploadedPath);
    if (downloadError || !downloaded) {
      return NextResponse.json({ error: `${staged.fileName} has not been uploaded or has expired.` }, { status: 400 });
    }
    try {
      intakeAttachments.push(await prepareAutomationAttachment({
        buffer: await downloaded.arrayBuffer(),
        fileName: staged.fileName,
        title: staged.title,
        visibility: staged.visibility,
      }));
      stagedPaths.push(staged.uploadedPath);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "A staged file is invalid." },
        { status: 400 },
      );
    }
  }
  const totalAttachmentSize = intakeAttachments.reduce(
    (total, attachment) => total + attachment.buffer.byteLength,
    0,
  );
  if (totalAttachmentSize > GROWTH_ENGINE_AUTOMATION_MAX_TOTAL_SIZE) {
    return NextResponse.json({ error: "Automated report files must be 40MB or smaller in total." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const { data: workspace, error: workspaceError } = await admin.from("cbb_growth_workspaces")
    .upsert({ client_id: clientId, updated_at: now }, { onConflict: "client_id" })
    .select("id").single();
  if (workspaceError || !workspace) return NextResponse.json({ error: "Workspace could not be prepared." }, { status: 500 });

  const generationKey = `external:${clientId}:${sourceKey}`;
  const { data: existing } = await admin.from("cbb_growth_reports")
    .select("id, status, generation_metadata").eq("generation_key", generationKey).maybeSingle();
  if (existing && existing.status !== "draft") {
    return NextResponse.json({ error: "That source report has already been published or withdrawn." }, { status: 409 });
  }
  const source = typeof body?.source === "string" ? body.source.trim().slice(0, 100) || "automation" : "automation";
  const existingAssets = automationAssetsFromMetadata(existing?.generation_metadata);
  const payload = {
    workspace_id: workspace.id,
    generation_key: generationKey,
    generation_source: "external",
    generation_metadata: {
      ...(existing?.generation_metadata && typeof existing.generation_metadata === "object"
        ? existing.generation_metadata as Record<string, unknown>
        : {}),
      source,
      sourceKey,
      receivedAt: now,
    },
    title: input.title,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    executive_summary: input.executiveSummary,
    strategic_takeaway: input.strategicTakeaway,
    progress_update: input.progressUpdate,
    next_priorities: input.nextPriorities,
    metrics: input.metrics,
    status: "draft",
    updated_at: now,
  };
  const query = existing
    ? admin.from("cbb_growth_reports").update(payload).eq("id", existing.id).eq("status", "draft")
    : admin.from("cbb_growth_reports").insert(payload);
  const { data: report, error } = await query.select("*").single();
  if (error || !report) return NextResponse.json({ error: "Draft could not be saved." }, { status: 500 });

  let assets = existingAssets;
  if (parsed.attachmentsProvided) {
    const prefix = automationStoragePrefix(clientId, sourceKey);
    const prepared = intakeAttachments.map((attachment, index) => ({
      attachment,
      storagePath: automationStoragePath(clientId, sourceKey, attachment, index),
    }));
    const wantedPaths = new Set(prepared.map((item) => item.storagePath));
    const { data: previousAssetRows } = await admin.from("cbb_growth_assets")
      .select("id, storage_path")
      .eq("report_id", report.id)
      .like("storage_path", `${prefix}/%`);

    const savedAssets = [];
    for (const item of prepared) {
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(
        item.storagePath,
        item.attachment.buffer,
        {
          contentType: item.attachment.contentType,
          upsert: true,
        },
      );
      if (uploadError) {
        return NextResponse.json({ error: `${item.attachment.fileName} could not be uploaded.` }, { status: 500 });
      }

      const { data: asset, error: assetError } = await admin.from("cbb_growth_assets").upsert({
        workspace_id: workspace.id,
        report_id: report.id,
        title: item.attachment.title,
        original_name: item.attachment.fileName,
        storage_path: item.storagePath,
        mime_type: item.attachment.contentType,
        size_bytes: item.attachment.buffer.byteLength,
        published_at: null,
        uploaded_by: null,
        updated_at: now,
      }, { onConflict: "storage_path" })
        .select("id, storage_path, title")
        .single();
      if (assetError || !asset) {
        return NextResponse.json({ error: `${item.attachment.fileName} metadata could not be saved.` }, { status: 500 });
      }
      savedAssets.push({
        id: asset.id,
        storagePath: asset.storage_path,
        title: asset.title,
        visibility: item.attachment.visibility,
      } as const);
    }

    const staleAssets = (previousAssetRows || []).filter((asset) => !wantedPaths.has(asset.storage_path));
    if (staleAssets.length) {
      await admin.from("cbb_growth_assets").delete().in("id", staleAssets.map((asset) => asset.id));
      await admin.storage.from(BUCKET).remove(staleAssets.map((asset) => asset.storage_path));
    }

    const generationMetadata = withAutomationAssets(
      report.generation_metadata,
      savedAssets,
      source,
      sourceKey,
    );
    const { data: updatedReport, error: metadataError } = await admin.from("cbb_growth_reports")
      .update({ generation_metadata: generationMetadata, updated_at: now })
      .eq("id", report.id)
      .eq("status", "draft")
      .select("*")
      .single();
    if (metadataError || !updatedReport) {
      return NextResponse.json({ error: "Automated file visibility could not be saved." }, { status: 500 });
    }
    Object.assign(report, updatedReport);
    assets = savedAssets;
    if (stagedPaths.length) await admin.storage.from(BUCKET).remove(stagedPaths);
  }

  await admin.from("cbb_growth_report_events").insert({
    report_id: report.id,
    event_type: existing ? "updated" : "created",
    metadata: { source: "external", sourceKey, attachmentCount: assets.length },
  });
  await admin.from("cbb_growth_connections")
    .update({ last_draft_at: now, updated_at: now })
    .eq("client_id", clientId);
  return NextResponse.json({
    report,
    assets,
    publishRequired: true,
    idempotencyKey: generationKey,
  }, { status: existing ? 200 : 201 });
}
