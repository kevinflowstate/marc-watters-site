import { adminActor, respond } from "@/lib/ops/http";
import { artifactSnapshot } from "@/lib/ops/action-validation";
import { readStagedContentImage, stageContentImage } from "@/lib/ops/content-media-staging";
export const maxDuration = 60;
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
type Context = { params: Promise<{ id: string; assetId: string }> };
function snapshot(request: Request) {
  const p = new URL(request.url).searchParams;
  return artifactSnapshot({ version: Number(p.get("version")), manifest_hash: p.get("manifest_hash") });
}
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    await adminActor();
    const { id, assetId } = await context.params;
    return stageContentImage(id, snapshot(request), assetId, request);
  });
}
export async function GET(request: Request, context: Context) {
  try {
    await adminActor();
    const { id, assetId } = await context.params;
    const image = await readStagedContentImage(id, snapshot(request), assetId);
    return new Response(Buffer.from(image.bytes), { headers: { ...privateHeaders, "Content-Type": image.mime_type } });
  } catch (e) { return respond(async () => { throw e; }); }
}
