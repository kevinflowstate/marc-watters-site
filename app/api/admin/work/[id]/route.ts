import { adminActor, respond } from "@/lib/ops/http";
import { decideTask, updateTask, completeTask } from "@/lib/ops/tasks";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, c: Context) {
  return respond(async () => {
    const actor = await adminActor(),
      { id } = await c.params,
      body = await request.json();
    return {
      task:
        body.status === "done"
          ? await completeTask(id, body.decision_note, actor)
          : await updateTask(id, body, actor),
    };
  });
}
export async function POST(request: Request, c: Context) {
  return respond(async () => {
    const actor = await adminActor(),
      { id } = await c.params,
      body = await request.json();
    return {
      task: await decideTask(id, body.decision, body.note || "", actor, actor),
    };
  });
}
