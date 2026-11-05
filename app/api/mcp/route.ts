import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  opsAccess,
  hasOpsScope,
  scopedTaskInput,
  type OpsAccess,
} from "@/lib/ops/action-access";
import {
  getArtifact,
  listArtifacts,
  listArtifactItems,
  getArtifactHistory,
  submitArtifact,
} from "@/lib/ops/actions";
import { respond } from "@/lib/ops/http";
import {
  createTask,
  listTasks,
  updateTask,
  attachOutput,
  OpsError,
} from "@/lib/ops/tasks";
import { areas, assignees, statuses } from "@/lib/ops/types";
import { getClient, listClientsNeedingAttention } from "@/lib/ops/clients";
import { getLesson, listLessons, proposeCuts } from "@/lib/ops/lessons";
import {
  createReportDraft,
  getReport,
  submitReportDraft,
} from "@/lib/ops/reports";
import { updateClientSignals, onboardingStages } from "@/lib/ops/onboarding";
export const runtime = "nodejs";
const id = z.string().uuid(),
  link = z.object({
    label: z.string(),
    url: z.string(),
    type: z.enum(["video", "image", "doc", "json"]).optional(),
  });
const task = {
  title: z.string().min(1).max(300),
  area: z.enum(areas),
  detail: z.string().optional(),
  assignee: z.enum(assignees).optional(),
  external_ref: z.string().optional(),
  client_id: id.optional(),
  due_at: z.string().optional(),
  links: z.array(link).optional(),
};
function makeHandler(access: OpsAccess) {
  return createMcpHandler(
    (server) => {
      const run = (fn: () => Promise<unknown>) =>
        Promise.resolve()
          .then(fn)
          .then((data) => ({
            content: [{ type: "text" as const, text: JSON.stringify(data) }],
          }))
          .catch((e) => ({
            isError: true,
            content: [
              {
                type: "text" as const,
                text:
                  e instanceof OpsError ? e.message : "Operation unavailable",
              },
            ],
          }));
      if (hasOpsScope(access, "tasks:write"))
        server.registerTool(
          "create_task",
          {
            description: "Add a piece of work to the team queue.",
            inputSchema: z.object({
              ...task,
              kind: z.enum(["task", "approval", "flag"]).default("task"),
            }),
          },
          (a) => run(() => createTask({ ...a, source: "ai" }, access.actor)),
        );
      if (hasOpsScope(access, "tasks:read"))
        server.registerTool(
          "list_tasks",
          {
            description: "See work filtered by status, area or owner.",
            inputSchema: z.object({
              status: z.enum(statuses).optional(),
              area: z.enum(areas).optional(),
              assignee: z.enum(assignees).optional(),
              clientId: id.optional(),
            }),
          },
          (a) => run(() => listTasks(a)),
        );
      if (hasOpsScope(access, "tasks:write"))
        server.registerTool(
          "update_task",
          {
            description:
              "Change a work item’s title, owner, due date or progress.",
            inputSchema: z.object({
              id,
              updates: z
                .object({
                  ...Object.fromEntries(
                    Object.entries(task).map(([k, v]) => [k, v.optional()]),
                  ),
                  ...(access.kind === "legacy"
                    ? {
                        status: z
                          .enum([
                            "open",
                            "in_progress",
                            "awaiting_approval",
                            "done",
                            "cancelled",
                          ])
                          .optional(),
                      }
                    : {}),
                })
                .strict(),
            }),
          },
          (a) =>
            run(() =>
              updateTask(
                a.id,
                access.kind === "scoped"
                  ? scopedTaskInput(a.updates)
                  : a.updates,
                access.actor,
              ),
            ),
        );
      if (hasOpsScope(access, "tasks:write"))
        server.registerTool(
          "request_approval",
          {
            description: "Put a proposed output in the human approval queue.",
            inputSchema: z.object(task),
          },
          (a) =>
            run(() =>
              createTask(
                {
                  ...a,
                  kind: "approval",
                  source: "ai",
                  status: "awaiting_approval",
                },
                access.actor,
              ),
            ),
        );
      if (hasOpsScope(access, "tasks:write"))
        server.registerTool(
          "attach_output",
          {
            description:
              "Attach a finished file or design link to a work item.",
            inputSchema: z.object({ id, output: link }),
          },
          (a) => run(() => attachOutput(a.id, a.output, access.actor)),
        );
      if (access.kind === "legacy")
        server.registerTool(
          "update_client_onboarding",
          {
            description:
              "Advance a client’s onboarding checklist after a confirmed step.",
            inputSchema: z.object({ id, stage: z.enum(onboardingStages) }),
          },
          (a) =>
            run(() => updateClientSignals(a.id, { stage: a.stage }, "mcp")),
        );
      if (access.kind === "legacy")
        server.registerTool(
          "get_client",
          {
            description:
              "Read a client’s payment, onboarding and engagement summary.",
            inputSchema: z.object({ id }),
          },
          (a) => run(() => getClient(a.id)),
        );
      if (access.kind === "legacy")
        server.registerTool(
          "list_clients_needing_attention",
          {
            description:
              "Find clients who need payment, onboarding or engagement follow-up.",
            inputSchema: z.object({}),
          },
          () => run(() => listClientsNeedingAttention()),
        );
      if (access.kind === "legacy")
        server.registerTool(
          "get_lesson",
          {
            description:
              "Read a recording, transcript and proposed editing cuts.",
            inputSchema: z.object({ id }),
          },
          (a) => run(() => getLesson(a.id)),
        );
      if (access.kind === "legacy")
        server.registerTool(
          "list_lessons",
          {
            description: "See lesson recordings and their preparation status.",
            inputSchema: z.object({}),
          },
          () => run(() => listLessons()),
        );
      if (access.kind === "legacy")
        server.registerTool(
          "propose_lesson_cuts",
          {
            description:
              "Legacy portal cut review only; requires OPS_LEGACY_LESSON_PIPELINE_ENABLED. Save supplied cuts without a model or render. In the standard workflow, review edits in Codex/Drive and attach the preview to a workspace task.",
            inputSchema: z.object({
              id,
              cuts: z
                .array(
                  z.object({
                    start_s: z.number(),
                    end_s: z.number(),
                    reason: z.enum([
                      "housekeeping",
                      "dead_air",
                      "admin",
                      "off_topic",
                      "tech_issue",
                    ]),
                    confidence: z.number().min(0).max(1),
                    snippet: z.string(),
                    keep: z.boolean(),
                  }),
                )
                .max(500),
            }),
          },
          (a) => run(() => proposeCuts(a.id, a.cuts)),
        );
      if (hasOpsScope(access, "reports:write"))
        server.registerTool(
          "create_report_draft",
          {
            description:
              "Gather weekly source figures without calling AI. Read the report, write the narrative in Codex, then use submit_report_draft.",
            inputSchema: z.object({}),
          },
          () => run(() => createReportDraft()),
        );
      if (hasOpsScope(access, "reports:read"))
        server.registerTool(
          "get_report",
          {
            description:
              "Read a report’s source figures, text and updated_at revision before preparing its narrative.",
            inputSchema: z.object({ id }),
          },
          (a) => run(() => getReport(a.id)),
        );
      if (hasOpsScope(access, "reports:write"))
        server.registerTool(
          "submit_report_draft",
          {
            description:
              "Save report text prepared in Codex against the exact updated_at revision. Leaves it in human review; never sends or approves.",
            inputSchema: z.object({
              id,
              expected_updated_at: z.string(),
              narrative_md: z.string().min(1).max(50000),
            }),
          },
          (a) =>
            run(() =>
              submitReportDraft(a.id, {
                expected_updated_at: a.expected_updated_at,
                narrative_md: a.narrative_md,
              }),
            ),
        );
      if (hasOpsScope(access, "artifacts:read")) {
        server.registerTool(
          "list_artifacts",
          {
            description:
              "List prepared content/lesson versions and actual execution states.",
            inputSchema: z.object({}),
          },
          () => run(() => listArtifacts()),
        );
        server.registerTool(
          "get_artifact",
          {
            description:
              "Read the exact prepared version/hash, saved human review notes and per-item results; does not approve or execute.",
            inputSchema: z.object({ id }),
          },
          (a) =>
            run(async () => {
              const [artifact, items, decisions] = await Promise.all([
                getArtifact(a.id),
                listArtifactItems(a.id),
                getArtifactHistory(a.id),
              ]);
              return { artifact, items, decisions };
            }),
        );
      }
      if (hasOpsScope(access, "artifacts:write"))
        server.registerTool(
          "submit_artifact",
          {
            description:
              "Submit/revise a prepared content or lesson proposal for human review. Never approves, publishes or schedules.",
            inputSchema: z
              .object({
                external_ref: z.string().min(1).max(300),
                kind: z.enum(["content", "lesson"]),
                action: z.enum(["schedule_content", "publish_lesson"]),
                title: z.string().min(1).max(300),
                payload: z.record(z.string(), z.unknown()),
                destination: z.record(z.string(), z.unknown()),
                item_keys: z.array(z.string().min(1).max(200)).min(1).max(100),
                expected_version: z.number().int().positive().optional(),
                expected_manifest_hash: z
                  .string()
                  .regex(/^[a-f0-9]{64}$/)
                  .optional(),
              })
              .strict(),
          },
          (a) => run(() => submitArtifact(a, access.actor)),
        );
    },
    { serverInfo: { name: "cbb-ops", version: "1.1.0" } },
  );
}
async function handle(request: Request) {
  let access: OpsAccess;
  try {
    access = opsAccess(request);
  } catch (e) {
    return respond(async () => {
      throw e;
    });
  }
  return makeHandler(access)(request);
}
export { handle as GET, handle as POST, handle as DELETE };
