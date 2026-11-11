import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { sendTeamTaskEmail } from "@/lib/email-templates";
import { getSiteUrl } from "@/lib/site-url";
import { getEnv } from "@/lib/env";
import { ownerLabels } from "./workspace";
import type { OpsTask } from "./types";

/**
 * Tells Marc or Eimear when the other adds a task for them or passes one over (Kevin, 11 Nov 2026):
 * an email, plus a phone notification if they have turned those on. Only people-made tasks for a
 * named person; Codex and portal tasks never email anyone. Never fails the task change itself.
 * Off switch: OPS_TASK_NOTIFICATIONS=off.
 */

type AdminUser = { id: string; email: string; full_name: string | null };

export type NotifyDeps = {
  admins: () => Promise<AdminUser[]>;
  email: typeof sendTeamTaskEmail;
  push: typeof sendPushToUser;
  record: (row: { user_id: string; title: string; message: string; link: string; dedupe_key: string }) => Promise<boolean>;
};

const firstWord = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";

function dueText(due: string | null) {
  if (!due || !Number.isFinite(Date.parse(due))) return null;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date(due));
}

function defaults(): NotifyDeps {
  return {
    admins: async () => {
      const r = await createAdminClient().from("users").select("id,email,full_name").eq("role", "admin");
      if (r.error) throw new Error("admins unavailable");
      return (r.data || []) as AdminUser[];
    },
    email: sendTeamTaskEmail,
    push: sendPushToUser,
    // The (user_id, dedupe_key) unique index makes a repeat call a no-op: false means already told.
    record: async (row) => !(await createAdminClient().from("notifications").insert(row)).error,
  };
}

export async function notifyTaskOwner(
  task: Pick<OpsTask, "id" | "title" | "detail" | "assignee" | "source" | "due_at">,
  actorId: string,
  reason: "created" | "assigned",
  supplied?: Partial<NotifyDeps>,
) {
  if (getEnv("OPS_TASK_NOTIFICATIONS") === "off") return { notified: false, why: "off" };
  if (task.assignee !== "marc" && task.assignee !== "eimear") return { notified: false, why: "not a person" };
  if (reason === "created" && task.source !== "human") return { notified: false, why: "automatic task" };
  const d = { ...defaults(), ...supplied };
  try {
    const admins = await d.admins();
    const label = ownerLabels[task.assignee].toLowerCase();
    const to = admins.find((a) => firstWord(a.full_name) === label);
    if (!to) return { notified: false, why: "no account" };
    if (to.id === actorId) return { notified: false, why: "own task" };
    const fromName = admins.find((a) => a.id === actorId)?.full_name?.split(" ")[0] || "The team";
    const link = `/admin/work?task=${task.id}`;
    const title = reason === "assigned" ? `${fromName} passed you a task` : `New task from ${fromName}`;
    const fresh = await d.record({
      user_id: to.id,
      title,
      message: task.title.slice(0, 200),
      link,
      dedupe_key: `team-task:${task.id}:${reason}`,
    });
    if (!fresh) return { notified: false, why: "already told" };
    await Promise.allSettled([
      d.email(to.email, {
        recipientName: to.full_name || "",
        fromName,
        title: task.title,
        detail: task.detail,
        due: dueText(task.due_at),
        url: `${getSiteUrl()}${link}`,
        reassigned: reason === "assigned",
        taskId: task.id,
      }),
      d.push(to.id, { title, body: task.title.slice(0, 140), url: link, tag: `team-task:${task.id}` }),
    ]);
    return { notified: true, why: "sent" };
  } catch {
    console.error("Team task notification unavailable");
    return { notified: false, why: "error" };
  }
}
