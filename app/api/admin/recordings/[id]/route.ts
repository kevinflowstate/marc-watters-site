import { adminActor, respond } from "@/lib/ops/http";
import { getLesson, sourceUrl, lessonAction } from "@/lib/ops/lessons";
import { createAdminClient } from "@/lib/supabase/admin";
type C = { params: Promise<{ id: string }> };
export async function GET(_r: Request, c: C) {
  return respond(async () => {
    await adminActor();
    const { id } = await c.params;
    const modules = await createAdminClient()
      .from("training_modules")
      .select("id,title,is_published")
      .order("order_index");
    return {
      lesson: await getLesson(id),
      source_url: await sourceUrl(id),
      modules: modules.data || [],
    };
  });
}
export async function POST(r: Request, c: C) {
  return respond(async () => {
    await adminActor();
    return { result: await lessonAction((await c.params).id, await r.json()) };
  });
}
