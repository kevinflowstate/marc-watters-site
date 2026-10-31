import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOpsAdmins } from "@/lib/ops/notify";
import {
  areas,
  assignees,
  statuses,
  type OpsTask,
  type OpsLink,
} from "./types";
export * from "./types";
export class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new OpsError("JSON object required");
  return input as Record<string, unknown>;
}
export function uuid(id: unknown): string {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new OpsError("Valid id required");
  return id;
}
export function safeLink(input: unknown): OpsLink {
  const v = record(input);
  if (
    typeof v.label !== "string" ||
    !v.label.trim() ||
    typeof v.url !== "string" ||
    !(
      (v.url.startsWith("/") && !v.url.startsWith("//")) ||
      /^https?:\/\//.test(v.url)
    )
  )
    throw new OpsError("Link needs a label and HTTP or portal URL");
  if (v.type && !["video", "image", "doc", "json"].includes(String(v.type)))
    throw new OpsError("Invalid output type");
  return {
    label: v.label.slice(0, 200),
    url: v.url,
    ...(v.type ? { type: v.type as OpsLink["type"] } : {}),
  };
}
function validate(input: unknown, create = false) {
  const body = record(input),
    out: Record<string, unknown> = {};
  const allowed = [
    "kind",
    "status",
    "title",
    "detail",
    "area",
    "assignee",
    "priority",
    "client_id",
    "links",
    "outputs",
    "payload",
    "due_at",
    ...(create ? ["source", "external_ref"] : []),
  ];
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) continue;
    if (!allowed.includes(key)) throw new OpsError(`Unsupported field: ${key}`);
    out[key] = body[key];
  }
  for (const [key, choices] of Object.entries({
    kind: ["task", "approval", "flag"],
    status: statuses,
    area: areas,
    assignee: assignees,
    source: ["system", "ai", "human"],
  })) {
    if (key in out && !choices.includes(String(out[key]) as never))
      throw new OpsError(`Invalid ${key}`);
  }
  if (create && (!out.kind || !out.area || !out.title))
    throw new OpsError("kind, area and title required");
  if ("title" in out) {
    if (
      typeof out.title !== "string" ||
      !out.title.trim() ||
      out.title.length > 300
    )
      throw new OpsError("Title must be 1–300 characters");
    out.title = out.title.trim();
  }
  for (const key of ["detail", "external_ref"]) {
    if (
      key in out &&
      out[key] !== null &&
      (typeof out[key] !== "string" || (out[key] as string).length > 20000)
    )
      throw new OpsError(`Invalid ${key}`);
  }
  if ("priority" in out && ![1, 2, 3].includes(Number(out.priority)))
    throw new OpsError("Invalid priority");
  if (out.client_id) uuid(out.client_id);
  if (
    out.due_at &&
    (typeof out.due_at !== "string" || !Number.isFinite(Date.parse(out.due_at)))
  )
    throw new OpsError("Invalid due date");
  for (const key of ["links", "outputs"]) {
    if (key in out) {
      if (!Array.isArray(out[key])) throw new OpsError(`Invalid ${key}`);
      out[key] = (out[key] as unknown[]).map(safeLink);
    }
  }
  if ("payload" in out) out.payload = record(out.payload);
  return out;
}
async function mutate(
  action: string,
  data: Record<string, unknown>,
  actor: string,
  id?: string,
) {
  const db = createAdminClient();
  const r = await db.rpc("ops_mutate_task", {
    p_action: action,
    p_data: data,
    p_actor: actor,
    p_id: id ? uuid(id) : null,
  });
  if (r.error)
    throw new OpsError(r.error.message, r.error.code === "P0002" ? 404 : 409);
  return r.data as OpsTask;
}
export async function createTask(input: unknown, actor = "system") {
  const data = validate(input, true);
  const task = await mutate("create", data, actor);
  if (task.kind === "approval")
    await notifyOpsAdmins(
      "Work needs approval",
      task.title,
      `/admin/work?task=${task.id}`,
      `approval:${task.id}`,
    );
  return task;
}
export async function listTasks(
  filters: {
    status?: string;
    area?: string;
    assignee?: string;
    clientId?: string;
  } = {},
) {
  let q = createAdminClient()
    .from("ops_tasks")
    .select("*,client_profiles(users!client_profiles_user_id_fkey(full_name))")
    .order("priority")
    .order("due_at", { nullsFirst: false })
    .order("id");
  for (const [k, v] of Object.entries(filters))
    if (v) q = q.eq(k === "clientId" ? "client_id" : k, v);
  const tasks: OpsTask[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const r = await q.range(offset, offset + 999);
    if (r.error) throw new OpsError(r.error.message, 500);
    tasks.push(...(r.data as OpsTask[]));
    if (r.data.length < 1000) return tasks;
  }
  throw new OpsError(
    "Work queue exceeds supported size; narrow the filters",
    503,
  );
}
export function updateTask(id: string, input: unknown, actor = "system") {
  const data = validate(input);
  if (data.status === "approved" || data.status === "rejected")
    throw new OpsError("Use the approval decision action");
  return mutate("update", data, actor, id);
}
export function decideTask(
  id: string,
  decision: "approved" | "rejected",
  note: string,
  userId?: string,
  actor = "system",
) {
  if (!["approved", "rejected"].includes(decision))
    throw new OpsError("Invalid decision");
  if (decision === "rejected" && !note?.trim())
    throw new OpsError("Add a rejection note");
  return mutate(
    "decide",
    {
      status: decision,
      decision_note: note?.slice(0, 20000) || null,
      decided_by: userId ? uuid(userId) : null,
    },
    actor,
    id,
  );
}
export function completeTask(id: string, note?: string, actor = "system") {
  return mutate(
    "complete",
    { status: "done", ...(note ? { decision_note: note } : {}) },
    actor,
    id,
  );
}
export function attachOutput(id: string, output: unknown, actor = "system") {
  return mutate("attach_output", safeLink(output), actor, id);
}

export async function reopenApproval(id: string, actor = "system") {
  const task = await mutate(
    "reopen",
    {
      status: "awaiting_approval",
      decided_by: null,
      decided_at: null,
      decision_note: null,
    },
    actor,
    id,
  );
  await notifyOpsAdmins(
    "Work needs approval",
    task.title,
    `/admin/work?task=${task.id}`,
    `approval:${task.id}:${task.updated_at}`,
  );
  return task;
}
