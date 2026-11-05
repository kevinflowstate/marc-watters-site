import { respond } from "@/lib/ops/http";
import { opsAccess, scopedTaskInput } from "@/lib/ops/action-access";
import { createTask, listTasks } from "@/lib/ops/tasks";
import { taskFilters } from "@/lib/ops/http";
export async function GET(request: Request) {
  return respond(async () => {
    opsAccess(request, "tasks:read");
    return { tasks: await listTasks(taskFilters(request)) };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const access = opsAccess(request, "tasks:write");
    const body = await request.json();
    return {
      task: await createTask(
        access.kind === "scoped" ? scopedTaskInput(body, true) : body,
        access.actor,
      ),
    };
  });
}
