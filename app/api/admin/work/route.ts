import { adminActor, respond, taskFilters } from "@/lib/ops/http";
import { createTask, listTasks } from "@/lib/ops/tasks";
import { notifyTaskOwner } from "@/lib/ops/task-notify";
export async function GET(request: Request) {
  return respond(async () => {
    await adminActor();
    return { tasks: await listTasks(taskFilters(request)) };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor();
    const task = await createTask(await request.json(), actor);
    // Marc or Eimear adding a task for the other: tell them. Never blocks the task itself.
    const notice = await notifyTaskOwner(task, actor, "created");
    return { task, notified: notice.notified };
  });
}
