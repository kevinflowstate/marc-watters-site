import { adminActor } from "@/lib/ops/http";
import { contentResponse } from "@/lib/content/http";
import { walkInbox } from "@/lib/content/drive";
export const maxDuration = 120;
export async function GET() {
  return contentResponse(async () => {
    await adminActor();
    const tree = await walkInbox("map");
    return {
      configured: tree.configured,
      files: tree.files.map((f) => ({
        name: f.name,
        path: f.path,
        mimeType: f.mimeType,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
      })),
    };
  });
}
