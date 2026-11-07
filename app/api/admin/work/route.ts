import { adminActor, respond, taskFilters } from "@/lib/ops/http";
import { createTask, listTasks } from "@/lib/ops/tasks";
export async function GET(request: Request) {
  return respond(async () => {
    await adminActor();
    return { tasks: await listTasks(taskFilters(request)) };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor();
    return { task: await createTask(await request.json(), actor) };
  });
}
