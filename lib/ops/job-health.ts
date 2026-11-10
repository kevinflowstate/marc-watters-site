import { createAdminClient } from "@/lib/supabase/admin";
import { createTask } from "./tasks";

/**
 * Scheduled Codex jobs fail quietly: a run that never happens leaves nothing behind, and a bad
 * result file is only counted. This turns each kind of failure into ONE task in the Flowstate
 * lane (stable references, so repeat checks never duplicate it). Nothing here retries a job,
 * contacts anyone or changes the jobs themselves.
 */

type Raise = typeof createTask;

export type ExpectedJob = {
  key: string;
  name: string;
  kind: string;
  /** London time by which the result should be in the portal, as minutes after midnight. */
  dueBy: number;
};

/** Only the jobs that are switched on. Add a job here when it is activated. */
export const ACTIVE_JOBS: ExpectedJob[] = [
  { key: "daily", name: "Daily attention brief (08:30)", kind: "daily_brief", dueBy: 9 * 60 + 40 },
  { key: "sales", name: "Sales-call reviews (17:30)", kind: "sales_review", dueBy: 18 * 60 + 40 },
];

export function londonClock(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: !["Sat", "Sun"].includes(parts.weekday),
  };
}

async function raise(raiseTask: Raise, ref: string, title: string, detail: string, priority = 2) {
  await raiseTask(
    { kind: "task", area: "other", assignee: "flowstate", source: "automation", priority, external_ref: ref, title, detail },
    "system",
  );
}

type ResultRow = { kind: string; outcome: string; observed_at: string; run_key: string };

async function todaysResults(date: string): Promise<ResultRow[]> {
  // A day either side covers the London/UTC offset; the London date is checked below.
  const from = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString();
  const to = new Date(Date.parse(`${date}T00:00:00Z`) + 2 * 86_400_000).toISOString();
  const r = await createAdminClient()
    .from("ops_workspace_results")
    .select("kind,outcome,observed_at,run_key")
    .gte("observed_at", from)
    .lt("observed_at", to)
    .limit(200);
  if (r.error) throw new Error("results unreadable");
  return (r.data || []) as ResultRow[];
}

/** Raises a task for each active job whose result has not arrived by its deadline, or that reported failure. */
export async function checkScheduledJobs(
  now = new Date(),
  deps: { results?: (date: string) => Promise<ResultRow[]>; raiseTask?: Raise } = {},
) {
  const clock = londonClock(now);
  const raised: string[] = [];
  if (!clock.weekday) return { checked: false, raised };
  const rows = (await (deps.results ?? todaysResults)(clock.date)).filter(
    (r) => londonClock(new Date(r.observed_at)).date === clock.date,
  );
  const raiseTask = deps.raiseTask ?? createTask;
  for (const job of ACTIVE_JOBS) {
    const mine = rows.filter((r) => r.kind === job.kind);
    if (mine.some((r) => r.outcome === "failed")) {
      const ref = `job-health:failed:${job.key}:${clock.date}`;
      await raise(
        raiseTask,
        ref,
        `${job.name} reported a failure · ${clock.date}`,
        "The job ran but said it could not finish. Open its result under Prepared by Codex to see what it could not reach, fix the connection, then run it again from Codex by hand if today's output is still needed.",
      );
      raised.push(ref);
    } else if (!mine.length && clock.minutes >= job.dueBy) {
      const ref = `job-health:missed:${job.key}:${clock.date}`;
      await raise(
        raiseTask,
        ref,
        `${job.name} has not arrived · ${clock.date}`,
        "No result from this scheduled job has reached the portal today. In Marc's Codex, open Scheduled and check the job's last run: if it ran, check its result file is in the CBB Portal Handoff folder; if it did not run, check the job is still Active. The portal collects result files every 10 minutes.",
        1,
      );
      raised.push(ref);
    }
  }
  return { checked: true, raised };
}

export type FileProblem = { trusted: boolean; name: string; reason: string };

/** At most ONE task per day for rejected result files, naming only files from Marc's own account. */
export async function reportFileProblems(problems: FileProblem[], now = new Date(), raiseTask: Raise = createTask) {
  if (!problems.length) return;
  const clock = londonClock(now);
  const named = problems.filter((p) => p.trusted).slice(0, 5).map((p) => `- ${p.name || "unnamed"}: ${p.reason}`);
  const others = problems.filter((p) => !p.trusted).length;
  const lines = [
    ...named,
    ...(problems.filter((p) => p.trusted).length > 5 ? ["- and more"] : []),
    ...(others ? [`- ${others} file${others === 1 ? "" : "s"} not from Marc's account ${others === 1 ? "was" : "were"} ignored (not opened)`] : []),
  ];
  await raise(
    raiseTask,
    `job-health:files:${clock.date}`,
    `Codex result files were not accepted · ${clock.date}`,
    `The portal skipped files in the CBB Portal Handoff folder. Nothing from them was saved.\n\n${lines.join("\n")}\n\nIf one came from a scheduled job, check the job's instructions still write the agreed result format. Only Marc's account should be able to add files to that folder.`,
  );
}

/** One task per day when a portal background step itself breaks. */
export async function reportStepFailure(step: "drive-results" | "portal-snapshot", message: string, now = new Date(), raiseTask: Raise = createTask) {
  const clock = londonClock(now);
  const what =
    step === "drive-results"
      ? { name: "Collecting Codex results from Drive", fix: "Check the CBB Portal Handoff folder is still shared with the portal's reader as Viewer and the Drive connection still works (Workspace > Connections)." }
      : { name: "Writing the portal snapshot for Codex", fix: "Check portal-snapshot.json is still shared with the portal's reader as Editor. Until it is fixed, scheduled jobs read an old snapshot; its observed_at time shows how old." };
  await raise(
    raiseTask,
    `job-health:step:${step}:${clock.date}`,
    `${what.name} failed · ${clock.date}`,
    `${message.slice(0, 300)}\n\n${what.fix} The portal retries on its own every 10 minutes; mark this done once it works again.`,
    1,
  ).catch(() => undefined);
}
