import { adminActor, respond } from "@/lib/ops/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTasks, OpsError, record, uuid } from "@/lib/ops/tasks";

function field(value: unknown, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new OpsError("Check the event details.");
  return value.trim();
}
function date(value: unknown) {
  const text = field(value, 10, true);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(text).toISOString().slice(0, 10) !== text
  )
    throw new OpsError("Choose a valid date.");
  return text;
}
export async function GET() {
  return respond(async () => {
    await adminActor();
    const [boards, tasks] = await Promise.all([
      createAdminClient()
        .from("ops_event_boards")
        .select("id,name,event_date,venue,agenda")
        .order("event_date", { ascending: false }),
      listTasks({ area: "events" }),
    ]);
    if (boards.error) throw new OpsError("Could not load events.", 503);
    return {
      boards: boards.data,
      tasks: tasks.filter(
        (t) => t.payload?.event_board_id && t.status !== "cancelled",
      ),
    };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor(),
      body = record(await request.json()),
      admin = createAdminClient();
    const id = uuid(body.id);
    if (body.action === "add_step") {
      const boardId = uuid(body.board);
      const result = await admin.rpc("ops_create_event_step", {
        p_board: boardId,
        p_step: id,
        p_title: field(body.title, 200, true),
        p_actor: actor,
      });
      if (result.error) throw new OpsError("Could not add event task.", 409);
    } else if (body.action === "create") {
      const result = await admin.rpc("ops_create_event_board", {
        p_board: id,
        p_name: field(body.name, 180, true),
        p_date: date(body.date),
        p_venue: field(body.venue, 300),
        p_agenda: field(body.agenda, 2500),
        p_actor: actor,
      });
      if (result.error)
        throw new OpsError("Could not create the event board.", 409);
    } else throw new OpsError("Unknown event action.");
    return { id };
  });
}
export async function PATCH(request: Request) {
  return respond(async () => {
    const actor = await adminActor(),
      body = record(await request.json());
    const result = await createAdminClient().rpc("ops_update_event_step", {
      p_board: uuid(body.board),
      p_task: uuid(body.id),
      p_version: field(body.version, 70, true),
      p_status: field(body.stage, 30, true),
      p_owner: field(body.owner, 16, true),
      p_due: body.due ? date(body.due) : null,
      p_note: field(body.note, 2500),
      p_actor: actor,
    });
    if (result.error)
      throw new OpsError(
        result.error.code === "40001"
          ? "This task changed. Refresh before saving."
          : "Check the task details and include a note for any question.",
        409,
      );
    return { id: body.id };
  });
}
