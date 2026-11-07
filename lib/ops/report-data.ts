import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
const DAY = 86400000;
export function reportPeriods(now = new Date()) {
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return {
    week_start: monday.toISOString().slice(0, 10),
    current: {
      from: monday.toISOString(),
      to: new Date(
        Math.min(now.getTime(), monday.getTime() + 3 * DAY),
      ).toISOString(),
    },
    previous: {
      from: new Date(monday.getTime() - 7 * DAY).toISOString(),
      to: monday.toISOString(),
    },
  };
}
function counts(rows: Record<string, unknown>[], key: string) {
  return rows.reduce<Record<string, number>>((out, r) => {
    const k = String(r[key] ?? "unknown");
    out[k] = (out[k] || 0) + 1;
    return out;
  }, {});
}
type QueryResult = { data: unknown[] | null; error: unknown };
type PageQuery = {
  range: (from: number, to: number) => PromiseLike<QueryResult>;
  order: (column: string) => PageQuery;
};
async function source(query: PageQuery) {
  query = query.order("id");
  try {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < 100000; offset += 1000) {
      const r = await query.range(offset, offset + 999);
      if (r.error) return { connected: false as const, note: "not connected" };
      const batch = (r.data || []) as Record<string, unknown>[];
      rows.push(...batch);
      if (batch.length < 1000) return { connected: true as const, rows };
    }
    return {
      connected: false as const,
      note: "not connected — report source exceeded supported size",
    };
  } catch {
    return { connected: false as const, note: "not connected" };
  }
}
async function social() {
  const token = getEnv("GHL_LOCATION_TOKEN");
  if (!token) return { connected: false, note: "not connected" };
  try {
    const origin = "https://services.leadconnectorhq.com",
      headers = {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
        "content-type": "application/json",
      },
      location = "93GJEdsr0cT9el3OINXq";
    const accounts = await fetch(
      `${origin}/social-media-posting/${location}/accounts`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (!accounts.ok) throw Error();
    const a = await accounts.json();
    const profiles = (a.results?.accounts || a.accounts || [])
      .map((x: { id?: string }) => x.id)
      .filter(Boolean);
    const [posts, stats] = await Promise.all([
      fetch(`${origin}/social-media-posting/${location}/posts/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "all",
          skip: "0",
          limit: "100",
          includeUsers: "false",
          fromDate: "",
          toDate: "",
        }),
        signal: AbortSignal.timeout(15000),
      }),
      profiles.length
        ? fetch(
            `${origin}/social-media-posting/statistics?locationId=${encodeURIComponent(location)}`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ profileIds: profiles }),
              signal: AbortSignal.timeout(15000),
            },
          )
        : Promise.resolve(null),
    ]);
    return {
      connected: true,
      publishing: posts.ok
        ? { connected: true, data: await posts.json() }
        : { connected: false, note: "not connected" },
      statistics: stats?.ok
        ? {
            connected: true,
            data: await stats.json(),
            period: "provider rolling last 7 days vs previous 7 days",
          }
        : { connected: false, note: "not connected" },
    };
  } catch {
    return { connected: false, note: "not connected" };
  }
}
export async function gatherReportData(now = new Date()) {
  const db = createAdminClient(),
    periods = reportPeriods(now);
  const [tasks, events, clients, lessons, checkins, inbox, socialData] =
    await Promise.all([
      source(
        db.from("ops_tasks").select("id,area,kind,status,due_at").order("id"),
      ),
      source(
        db
          .from("ops_events")
          .select("task_id,data,created_at")
          .order("id")
          .gte("created_at", periods.previous.from)
          .lt("created_at", periods.current.to),
      ),
      source(db.from("client_profiles").select("*").order("id")),
      source(
        db
          .from("lesson_recordings")
          .select("id,status,publish_due_at")
          .order("id"),
      ),
      source(
        db
          .from("checkins")
          .select("id,client_id,created_at")
          .order("id")
          .gte("created_at", periods.previous.from)
          .lt("created_at", periods.current.to),
      ),
      source(
        db
          .from("inbox_messages")
          .select("id,sender_role,created_at")
          .order("id")
          .gte("created_at", periods.previous.from)
          .lt("created_at", periods.current.to),
      ),
      social(),
    ]);
  const active = clients.connected
    ? clients.rows.filter((c) => !c.archived_at)
    : [];
  const periodData = (range: { from: string; to: string }) => {
    const within = (r: Record<string, unknown>) =>
      String(r.created_at) >= range.from && String(r.created_at) < range.to;
    const eligible = clients.connected
      ? clients.rows.filter(
          (c) =>
            Date.parse(String(c.created_at)) < Date.parse(range.to) &&
            (!c.archived_at ||
              Date.parse(String(c.archived_at)) >= Date.parse(range.from)),
        )
      : [];
    const doneIds = events.connected
      ? new Set(
          events.rows
            .filter(
              (r) =>
                within(r) &&
                (r.data as Record<string, unknown>)?.status === "done",
            )
            .map((r) => r.task_id),
        )
      : null;
    const submitted = checkins.connected
      ? new Set(checkins.rows.filter(within).map((r) => r.client_id))
      : null;
    return {
      range,
      tasks_completed:
        tasks.connected && doneIds
          ? {
              connected: true,
              total: doneIds.size,
              by_area: counts(
                tasks.rows.filter((t) => doneIds.has(t.id)),
                "area",
              ),
            }
          : { connected: false, note: "not connected" },
      checkins:
        submitted && clients.connected
          ? {
              connected: true,
              submitted: eligible.filter((c) => submitted.has(c.id)).length,
              expected: clients.connected ? eligible.length : null,
              submissions_total: checkins.connected
                ? checkins.rows.filter(within).length
                : null,
            }
          : { connected: false, note: "not connected" },
      inbox: inbox.connected
        ? {
            connected: true,
            total: inbox.rows.filter(within).length,
            by_sender: counts(inbox.rows.filter(within), "sender_role"),
          }
        : { connected: false, note: "not connected" },
    };
  };
  return {
    generated_at: now.toISOString(),
    periods,
    current: periodData(periods.current),
    previous: periodData(periods.previous),
    outstanding: tasks.connected
      ? {
          connected: true,
          by_area: counts(
            tasks.rows.filter(
              (t) =>
                !["done", "approved", "rejected", "cancelled"].includes(
                  String(t.status),
                ),
            ),
            "area",
          ),
          approvals_waiting: tasks.rows.filter(
            (t) =>
              t.kind === "approval" &&
              ["open", "in_progress", "awaiting_approval"].includes(
                String(t.status),
              ),
          ).length,
          flags: tasks.rows.filter(
            (t) =>
              t.kind === "flag" &&
              !["done", "cancelled", "rejected"].includes(String(t.status)),
          ).length,
        }
      : { connected: false, note: "not connected" },
    clients: clients.connected
      ? {
          connected: true,
          total: active.length,
          payment_statuses: counts(active, "payment_status"),
          onboarding_statuses: counts(active, "onboarding_stage"),
        }
      : { connected: false, note: "not connected" },
    lessons: lessons.connected
      ? {
          connected: true,
          by_status: counts(lessons.rows, "status"),
          past_due: lessons.rows.filter(
            (l) =>
              l.status !== "published" &&
              l.publish_due_at &&
              Date.parse(String(l.publish_due_at)) < now.getTime(),
          ).length,
        }
      : { connected: false, note: "not connected" },
    social_planner: socialData,
  };
}
