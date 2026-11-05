import { NextResponse } from "next/server";
import { adminActor, respond } from "@/lib/ops/http";
import { getVerifiedLessonMediaPreview } from "@/lib/ops/lesson-publication";
type Context = { params: Promise<{ verificationId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    await adminActor();
    const { url } = await getVerifiedLessonMediaPreview(
      (await context.params).verificationId,
    );
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return respond(async () => {
      throw error;
    });
  }
}
