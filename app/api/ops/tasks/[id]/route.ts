import { respond } from "@/lib/ops/http";
import {
  opsAccess,
  scopedTaskInput,
  scopedOutputInput,
} from "@/lib/ops/action-access";
import {
  updateTask,
  decideTask,
  attachOutput,
  completeTask,
} from "@/lib/ops/tasks";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, c: Context) {
  return respond(async () => {
    const access = opsAccess(request, "tasks:write");
    const { id } = await c.params;
    const b = await request.json();
    if (access.kind === "scoped")
      return { task: await updateTask(id, scopedTaskInput(b), access.actor) };
    return {
      task:
        b.status === "done"
          ? await completeTask(id, b.decision_note, "ops-token")
          : await updateTask(id, b, "ops-token"),
    };
  });
}
export async function POST(request: Request, c: Context) {
  return respond(async () => {
    const access = opsAccess(request, "tasks:write");
    const { id } = await c.params;
    const b = await request.json();
    if (access.kind === "scoped")
      return {
        task: await attachOutput(id, scopedOutputInput(b), access.actor),
      };
    return {
      task: b.output
        ? await attachOutput(id, b.output, "ops-token")
        : await decideTask(
            id,
            b.decision,
            b.note || "",
            undefined,
            "ops-token",
          ),
    };
  });
}
