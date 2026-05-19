import { sendCheckinReply } from "@/lib/checkin-replies";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 24 * 60 * 60 * 1000;

type ClientRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  business_type: string | null;
  goals: string | null;
  start_date: string;
  last_login: string | null;
  last_checkin: string | null;
  created_at: string;
  user?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }>;
};

type CheckinRow = {
  id: string;
  client_id: string;
  week_number: number;
  mood: string;
  wins: string | null;
  challenges: string | null;
  questions: string | null;
  responses?: Record<string, string> | null;
  admin_reply: string | null;
  replied_at: string | null;
  client_reply?: string | null;
  client_replied_at?: string | null;
  created_at: string;
  client?: {
    id?: string;
    business_name?: string | null;
    user?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }>;
  } | Array<{
    id?: string;
    business_name?: string | null;
    user?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }>;
  }>;
};

type InboxMessageRow = {
  id: string;
  client_id: string;
  sender_role: "admin" | "client";
  message: string | null;
  read_by_admin: boolean;
  created_at: string;
  attachments?: Array<{ id?: string; name?: string; type?: string }> | null;
};

export async function buildPortalSummary() {
  const admin = createAdminClient();
  const [clientsRes, checkinsRes, inboxRes] = await Promise.all([
    admin
      .from("client_profiles")
      .select("id, user_id, business_name, business_type, goals, start_date, last_login, last_checkin, created_at, user:users!client_profiles_user_id_fkey(full_name)")
      .order("created_at", { ascending: true }),
    admin
      .from("checkins")
      .select(`
        id, client_id, week_number, mood, wins, challenges, questions, responses, admin_reply, replied_at, client_reply, client_replied_at, created_at,
        client:client_profiles!checkins_client_id_fkey(
          id, business_name,
          user:users!client_profiles_user_id_fkey(full_name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("inbox_messages")
      .select("id, client_id, sender_role, message, read_by_admin, created_at, attachments")
      .eq("sender_role", "client")
      .eq("read_by_admin", false)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (checkinsRes.error) throw new Error(checkinsRes.error.message);
  if (inboxRes.error) throw new Error(inboxRes.error.message);

  const clients = (clientsRes.data || []) as ClientRow[];
  const checkins = (checkinsRes.data || []) as CheckinRow[];
  const now = Date.now();
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const riskFlags = clients.map((client) => {
    const status = statusForClient(client, now);
    return {
      clientId: client.id,
      name: userFromClient(client)?.full_name || "Unknown",
      business: client.business_name || "",
      status,
      daysSinceLogin: daysSince(client.last_login || client.created_at, now),
      daysSinceCheckin: daysSince(client.last_checkin || client.created_at, now),
    };
  });

  const unansweredCheckins = checkins
    .filter((checkin) => !checkin.admin_reply)
    .map(summariseCheckin)
    .slice(0, 20);

  const unreadInbox = ((inboxRes.data || []) as InboxMessageRow[]).map((message) => {
    const client = clientMap.get(message.client_id);
    return {
      messageId: message.id,
      clientId: message.client_id,
      client: userFromClient(client)?.full_name || "Unknown",
      business: client?.business_name || "",
      preview: inboxPreview(message),
      createdAt: message.created_at,
    };
  });

  const recentActivity = checkins.slice(0, 12).map((checkin) => ({
    type: checkin.admin_reply ? "checkin_replied" : "checkin_received",
    checkinId: checkin.id,
    clientId: checkin.client_id,
    client: clientNameFromCheckin(checkin),
    business: clientBusinessFromCheckin(checkin),
    mood: checkin.mood,
    createdAt: checkin.created_at,
    repliedAt: checkin.replied_at,
    needsReply: !checkin.admin_reply,
  }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      clients: clients.length,
      unansweredCheckins: unansweredCheckins.length,
      unreadClientMessages: unreadInbox.length,
      redClients: riskFlags.filter((item) => item.status === "red").length,
      amberClients: riskFlags.filter((item) => item.status === "amber").length,
    },
    unansweredCheckins,
    unreadClientMessages: unreadInbox,
    riskFlags,
    recentActivity,
  };
}

export async function buildClientThread(clientId: string) {
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name, business_type, goals, start_date, last_login, last_checkin, created_at, user:users!client_profiles_user_id_fkey(full_name)")
    .eq("id", clientId)
    .single<ClientRow>();

  if (profileError || !profile) {
    const error = new Error("client_not_found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const [checkinsRes, inboxRes, notesRes, plansRes, modulesRes] = await Promise.all([
    admin
      .from("checkins")
      .select("id, client_id, week_number, mood, wins, challenges, questions, responses, admin_reply, replied_at, client_reply, client_replied_at, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("inbox_messages")
      .select("id, sender_role, message, reply_context, read_by_admin, read_by_client, created_at, attachments")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("internal_notes")
      .select("content, updated_at")
      .eq("client_id", clientId)
      .maybeSingle(),
    admin
      .from("business_plans")
      .select(`
        id, summary, status, created_at, completed_at,
        phases:business_plan_phases(
          id, name, notes, order_index,
          items:business_plan_items(id, title, completed, completed_at, order_index)
        )
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    admin
      .from("client_modules")
      .select("status, started_at, completed_at, module:training_modules(id, title, description)")
      .eq("client_id", clientId),
  ]);

  if (checkinsRes.error) throw new Error(checkinsRes.error.message);
  if (inboxRes.error) throw new Error(inboxRes.error.message);
  if (plansRes.error) throw new Error(plansRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);

  return {
    generatedAt: new Date().toISOString(),
    client: {
      id: profile.id,
      name: userFromClient(profile)?.full_name || "Unknown",
      business: profile.business_name || "",
      businessType: profile.business_type || "",
      goals: profile.goals || "",
      startDate: profile.start_date,
      status: statusForClient(profile),
      lastLogin: profile.last_login,
      lastCheckin: profile.last_checkin,
    },
    checkins: ((checkinsRes.data || []) as CheckinRow[]).map((checkin) => ({
      ...summariseCheckin(checkin),
      adminReply: checkin.admin_reply,
      repliedAt: checkin.replied_at,
      clientReply: checkin.client_reply || null,
      clientRepliedAt: checkin.client_replied_at || null,
    })),
    inboxMessages: (inboxRes.data || []).map((message) => ({
      id: message.id,
      senderRole: message.sender_role,
      message: message.message || "",
      replyContext: message.reply_context || null,
      readByAdmin: message.read_by_admin,
      readByClient: message.read_by_client,
      attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
      createdAt: message.created_at,
    })),
    internalNotes: notesRes.data?.content || "",
    businessPlans: plansRes.data || [],
    assignedModules: modulesRes.data || [],
  };
}

export async function buildDraftReply(checkinId: string, guidance = "") {
  const admin = createAdminClient();
  const { data: checkin, error } = await admin
    .from("checkins")
    .select(`
      id, client_id, week_number, mood, wins, challenges, questions, responses, admin_reply, replied_at, created_at,
      client:client_profiles!checkins_client_id_fkey(
        business_name,
        user:users!client_profiles_user_id_fkey(full_name)
      )
    `)
    .eq("id", checkinId)
    .single();

  if (error || !checkin) {
    const notFound = new Error("checkin_not_found");
    (notFound as Error & { status?: number }).status = 404;
    throw notFound;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const unavailable = new Error("drafting_not_configured");
    (unavailable as Error & { status?: number }).status = 503;
    throw unavailable;
  }

  const cleanGuidance = guidance.trim().slice(0, 1000);
  const prompt = `Draft a concise reply from Marc Watters to this Construction Business Blueprint client check-in.

Client: ${clientNameFromCheckin(checkin as CheckinRow)}
Business: ${clientBusinessFromCheckin(checkin as CheckinRow)}
Mood: ${checkin.mood}
Wins: ${checkin.wins || ""}
Challenges: ${checkin.challenges || ""}
Questions: ${checkin.questions || ""}
Full responses: ${JSON.stringify(checkin.responses || {})}
Guidance from Flowstate agent: ${cleanGuidance}

Tone: direct, practical, supportive, construction-business specific. Do not overpromise. Do not mention AI or Flowstate.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: "You draft short, practical client replies for Marc Watters.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "draft_reply_failed");
  }

  return {
    checkinId,
    alreadyReplied: Boolean(checkin.admin_reply),
    draft: data.content?.[0]?.text || "",
  };
}

export async function sendApprovedCheckinReply({
  checkinId,
  replyText,
  senderUserId,
  approvalId,
  approvedBy,
  overwrite = false,
}: {
  checkinId: string;
  replyText: string;
  senderUserId: string;
  approvalId: string;
  approvedBy: string;
  overwrite?: boolean;
}) {
  return sendCheckinReply({
    checkinId,
    replyText,
    senderUserId,
    approvalId,
    approvedBy,
    overwrite,
  });
}

function summariseCheckin(checkin: CheckinRow) {
  return {
    checkinId: checkin.id,
    clientId: checkin.client_id,
    client: clientNameFromCheckin(checkin),
    business: clientBusinessFromCheckin(checkin),
    weekNumber: checkin.week_number,
    mood: checkin.mood,
    wins: checkin.wins,
    challenges: checkin.challenges,
    questions: checkin.questions,
    responses: checkin.responses || null,
    createdAt: checkin.created_at,
    needsReply: !checkin.admin_reply,
  };
}

function statusForClient(client: ClientRow, now = Date.now()) {
  const loginDays = daysSince(client.last_login || client.created_at, now) ?? 0;
  const checkinDays = daysSince(client.last_checkin || client.created_at, now) ?? 0;
  if (loginDays > 10 || checkinDays > 14) return "red";
  if (checkinDays > 7) return "amber";
  return "green";
}

function daysSince(value: string | null, now = Date.now()) {
  if (!value) return null;
  return Math.floor((now - new Date(value).getTime()) / DAY);
}

function userFromClient(client?: ClientRow) {
  return Array.isArray(client?.user) ? client?.user[0] : client?.user;
}

function clientNameFromCheckin(checkin: CheckinRow) {
  const client = Array.isArray(checkin.client) ? checkin.client[0] : checkin.client;
  const user = Array.isArray(client?.user) ? client?.user[0] : client?.user;
  return user?.full_name || "Unknown";
}

function clientBusinessFromCheckin(checkin: CheckinRow) {
  const client = Array.isArray(checkin.client) ? checkin.client[0] : checkin.client;
  return client?.business_name || "";
}

function inboxPreview(message: InboxMessageRow) {
  const text = typeof message.message === "string" ? message.message.trim() : "";
  if (text) return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (attachments.length === 1) return `Attachment: ${attachments[0]?.name || "file"}`;
  if (attachments.length > 1) return `${attachments.length} attachments`;
  return "";
}
