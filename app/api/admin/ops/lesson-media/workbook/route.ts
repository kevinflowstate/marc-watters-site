import { NextResponse } from "next/server";
import { adminActor, respond } from "@/lib/ops/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError } from "@/lib/ops/tasks";

/** Admin only: short-lived link to a privately stored workbook PDF (workbooks/<sha256>.pdf). */
export async function GET(request: Request) {
  try {
    await adminActor();
    const path = new URL(request.url).searchParams.get("path") || "";
    if (!/^workbooks\/[a-f0-9]{64}\.pdf$/.test(path)) throw new OpsError("Unknown workbook", 404);
    const signed = await createAdminClient().storage.from("lesson-media").createSignedUrl(path, 300);
    if (signed.error || !signed.data?.signedUrl) throw new OpsError("Workbook unavailable", 404);
    const response = NextResponse.redirect(signed.data.signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return respond(async () => {
      throw error;
    });
  }
}
