import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, uuid } from "./tasks";

type Row = Record<string, unknown> & { id: string };
const collections = {
  messages: {
    table: "inbox_messages",
    fields: "id,sender_role,message,read_by_admin,created_at,attachments",
  },
  checkins: {
    table: "checkins",
    fields:
      "id,week_number,mood,wins,challenges,questions,responses,admin_reply,replied_at,client_reply,client_replied_at,created_at",
  },
  training: {
    table: "client_modules",
    fields:
      "id,module_id,status,started_at,completed_at,module:training_modules(id,title)",
  },
  lessons: {
    table: "content_progress",
    fields:
      "id,content_id,completed,completed_at,content:module_content(id,module_id,title)",
  },
} as const;
type Collection = keyof typeof collections;
const clientFields =
  "id,business_name,start_date,last_login,last_checkin,created_at,user:users!client_profiles_user_id_fkey(full_name)";

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}
function timestamp(value: unknown): number | null {
  const result = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(result) ? result : null;
}
function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}
function relation(value: unknown): Record<string, unknown> {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" ? item : {};
}
function daysSince(value: unknown, now: number) {
  const time = timestamp(value);
  return time === null ? null : Math.max(0, Math.floor((now - time) / 86400000));
}
function clientSummary(row: Row, now = Date.now()) {
  const times = [timestamp(row.last_login), timestamp(row.last_checkin)].filter(
    (v): v is number => v !== null,
  );
  const lastActivity = times.length ? new Date(Math.max(...times)).toISOString() : null;
  return {
    id: row.id,
    name: text(relation(row.user).full_name) || "Unknown",
    business_name: text(row.business_name),
    started_at: text(row.start_date),
    created_at: text(row.created_at),
    last_portal_visit_at: text(row.last_login),
    last_checkin_at: text(row.last_checkin),
    last_recorded_activity_at: lastActivity,
    days_since_recorded_activity: daysSince(lastActivity, now),
    days_since_checkin: daysSince(row.last_checkin, now),
    // Creation is not evidence of engagement. Never replace an absent visit with it.
    days_since_created: daysSince(row.created_at, now),
    portal_path: `/admin/clients/${row.id}`,
  };
}

/** Read status is deliberately not used to decide whether a reply is outstanding. */
export function messageReplyState(latest: Row[]) {
  const first = latest[0];
  if (!first)
    return { needs_reply: false, reason: "no_messages", latest_message_id: null, latest_message_at: null };
  const at = timestamp(first.created_at);
  let needsReply: boolean | null = null;
  let reason = "message_order_uncertain";
  if (
    at !== null &&
    (!latest[1] || (timestamp(latest[1].created_at) !== null && timestamp(latest[1].created_at) !== at))
  ) {
    if (first.sender_role === "client") {
      needsReply = true;
      reason = "latest_message_from_client";
    } else if (first.sender_role === "admin") {
      needsReply = false;
      reason = "latest_message_from_admin";
    }
  }
  return {
    needs_reply: needsReply,
    reason,
    latest_message_id: first.id,
    latest_message_at: text(first.created_at),
  };
}

export function checkinReplyState(row: Row) {
  if (!hasText(row.admin_reply))
    return { needs_reply: true, reason: "no_admin_reply" };
  const replied = timestamp(row.replied_at);
  const created = timestamp(row.created_at);
  if (replied === null || created === null || replied < created)
    return { needs_reply: null, reason: "reply_order_uncertain" };
  if (!hasText(row.client_reply))
    return { needs_reply: false, reason: "admin_replied" };
  const clientReplied = timestamp(row.client_replied_at);
  if (clientReplied === null || clientReplied === replied)
    return { needs_reply: null, reason: "reply_order_uncertain" };
  return {
    needs_reply: clientReplied > replied,
    reason: clientReplied > replied ? "client_replied_after_admin" : "admin_replied",
  };
}

function pageInput(params: URLSearchParams, scope: string) {
  const rawLimit = params.get("limit") || "50";
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 100)
    throw new OpsError("limit must be between 1 and 100");
  const raw = params.get("cursor");
  let after: string | null = null;
  if (raw) {
    try {
      if (raw.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw Error();
      const cursor = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      if (
        !cursor || cursor.scope !== scope ||
        Object.keys(cursor).some((key) => !["scope", "after"].includes(key))
      ) throw Error();
      after = uuid(cursor.after);
    } catch {
      throw new OpsError("Invalid cursor for this collection");
    }
  }
  return { limit: Number(rawLimit), after, scope };
}
function pageResult(rows: Row[], page: ReturnType<typeof pageInput>) {
  const more = rows.length > page.limit;
  const items = rows.slice(0, page.limit);
  return {
    rows: items,
    coverage: {
      returned: items.length,
      limit: page.limit,
      has_more: more,
      next_cursor: more
        ? Buffer.from(JSON.stringify({ scope: page.scope, after: items.at(-1)!.id })).toString("base64url")
        : null,
      collection_complete_in_this_response: page.after === null && !more,
      end_of_collection: !more,
      consistency: "live_cursor_scan_not_transactional_snapshot",
      order: "id_ascending",
    },
  };
}
function assertRead(error: unknown) {
  if (error) throw new OpsError("Portal source could not be read; coverage is incomplete", 502);
}

export async function listPortalClients(params: URLSearchParams) {
  const page = pageInput(params, "active-clients");
  let query = createAdminClient()
    .from("client_profiles")
    .select(clientFields)
    .is("archived_at", null)
    .order("id", { ascending: true })
    .limit(page.limit + 1);
  if (page.after) query = query.gt("id", page.after);
  const result = await query;
  assertRead(result.error);
  const { rows, coverage } = pageResult((result.data || []) as Row[], page);
  return {
    observed_at: new Date().toISOString(),
    clients: rows.map((row) => clientSummary(row)),
    coverage,
  };
}

function presentRow(row: Row, collection: Collection) {
  if (collection === "messages")
    return {
      id: row.id,
      sender_role: row.sender_role,
      message: text(row.message),
      read_by_admin: row.read_by_admin === true,
      created_at: text(row.created_at),
      attachment_count: Array.isArray(row.attachments) ? row.attachments.length : 0,
    };
  if (collection === "checkins")
    return {
      id: row.id,
      week_number: row.week_number,
      mood: text(row.mood),
      wins: text(row.wins),
      challenges: text(row.challenges),
      questions: text(row.questions),
      responses: row.responses || null,
      admin_reply: text(row.admin_reply),
      replied_at: text(row.replied_at),
      client_reply: text(row.client_reply),
      client_replied_at: text(row.client_replied_at),
      created_at: text(row.created_at),
      ...checkinReplyState(row),
    };
  if (collection === "training")
    return {
      id: row.id,
      module_id: row.module_id,
      title: text(relation(row.module).title),
      recorded_status: row.status,
      started_at: text(row.started_at),
      completed_at: text(row.completed_at),
    };
  return {
    id: row.id,
    content_id: row.content_id,
    module_id: relation(row.content).module_id || null,
    title: text(relation(row.content).title),
    recorded_completed: typeof row.completed === "boolean" ? row.completed : null,
    completed_at: text(row.completed_at),
  };
}

export async function readPortalCollection(id: string, name: string, params: URLSearchParams) {
  const clientId = uuid(id);
  if (!Object.hasOwn(collections, name)) throw new OpsError("Unknown portal collection", 404);
  const collection = name as Collection;
  const page = pageInput(params, `${clientId}/${collection}`);
  const admin = createAdminClient();
  const clientResult = await admin.from("client_profiles")
    .select(clientFields).eq("id", clientId).is("archived_at", null).maybeSingle();
  assertRead(clientResult.error);
  if (!clientResult.data) throw new OpsError("Client not found", 404);
  const config = collections[collection];
  let query = admin.from(config.table as string)
    .select<string, Row>(`${config.fields},client:client_profiles!inner(archived_at)`)
    .eq("client_id", clientId).is("client.archived_at", null)
    .order("id", { ascending: true }).limit(page.limit + 1);
  if (page.after) query = query.gt("id", page.after);
  const result = await query;
  assertRead(result.error);
  const { rows, coverage } = pageResult((result.data || []) as Row[], page);

  // A separate current latest-turn read keeps historical pages from being
  // mistaken for the current conversation. Equal/missing timestamps stay unknown.
  let conversation;
  if (collection === "messages") {
    const latest = await admin.from("inbox_messages")
      .select("id,sender_role,created_at,client:client_profiles!inner(archived_at)")
      .eq("client_id", clientId).is("client.archived_at", null)
      .order("created_at", { ascending: false, nullsFirst: true })
      .order("id", { ascending: false }).limit(2);
    assertRead(latest.error);
    conversation = messageReplyState((latest.data || []) as Row[]);
  }
  return {
    observed_at: new Date().toISOString(),
    client: clientSummary(clientResult.data as Row),
    collection,
    items: rows.map((row) => presentRow(row, collection)),
    ...(conversation ? { conversation } : {}),
    coverage,
    ...(collection === "training" || collection === "lessons"
      ? { interpretation: "Recorded portal status only; not proof of video watch time or understanding. Missing lesson-progress rows do not establish completion." }
      : {}),
  };
}
