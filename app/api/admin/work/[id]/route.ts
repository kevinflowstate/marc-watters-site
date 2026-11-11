import { adminActor, respond } from "@/lib/ops/http";
import { decideTask, listTaskEvents, updateTask, completeTask } from "@/lib/ops/tasks";
import { notifyTaskOwner } from "@/lib/ops/task-notify";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, c: Context) {
  return respond(async () => {
    await adminActor();
    const { id } = await c.params;
    return { events: await listTaskEvents(id) };
  });
}
export async function PATCH(request: Request, c: Context) {
  return respond(async () => {
    const actor = await adminActor(),
      { id } = await c.params,
      body = await request.json();
    if (body.status === "done") return { task: await completeTask(id, body.decision_note, actor) };
    const task = await updateTask(id, body, actor);
    // Passing a task to Marc or Eimear tells them, whoever first created it.
    if (typeof body.assignee === "string") await notifyTaskOwner({ ...task, source: "human" }, actor, "assigned");
    return { task };
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
