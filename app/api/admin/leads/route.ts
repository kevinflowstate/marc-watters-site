import { requireLeadsAccess } from "@/lib/lead-dms/access";
import { REPLY_WINDOW_MS } from "@/lib/lead-dms/config";
import { strategyCallBookings } from "@/lib/lead-dms/crm";
import { OPEN_STATUSES } from "@/lib/lead-dms/rules";
import { syncLeadDms } from "@/lib/lead-dms/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const COLUMNS =
  "id, conversation_id, contact_name, profile_photo, inbound_at, inbound_text, status, for_marc, draft_text, final_text, needs_reason, decided_at, decided_by";

async function load() {
  const admin = createAdminClient();
  const now = Date.now();
  const since = new Date(now - REPLY_WINDOW_MS).toISOString();
  const [open, sent, admins, bookings] = await Promise.all([
    admin.from("lead_dm_drafts").select(COLUMNS).in("status", [...OPEN_STATUSES]).gt("inbound_at", since).order("inbound_at", { ascending: false }).limit(100),
    admin.from("lead_dm_drafts").select(COLUMNS).in("status", ["sent", "edited_sent"]).gt("decided_at", since).order("decided_at", { ascending: false }).limit(50),
    admin.from("users").select("id, full_name").eq("role", "admin"),
    strategyCallBookings(now - 28 * 86400000, now + 7 * 86400000, {}, true).then(
      (rows) => ({ rows, error: null as string | null }),
      (e) => ({ rows: [], error: e instanceof Error ? e.message : "CRM error" }),
    ),
  ]);
  if (open.error || sent.error) throw new Error(open.error?.message || sent.error?.message);
  const names = new Map((admins.data || []).map((u) => [u.id as string, String(u.full_name || "").split(" ")[0] || "Admin"]));
  const shape = (r: Record<string, unknown>) => ({
    ...r,
    window_ends_at: new Date(Date.parse(String(r.inbound_at)) + REPLY_WINDOW_MS).toISOString(),
    decided_by: r.decided_by ? names.get(String(r.decided_by)) ?? null : null,
  });
  return {
    waiting: (open.data || []).map(shape),
    sent: (sent.data || []).map(shape),
    bookings: bookings.rows.filter((row) => Date.parse(row.endTime || row.startTime) > now && row.status !== "cancelled"),
    recentBookings: bookings.rows.filter((row) => Date.parse(row.endTime || row.startTime) <= now).reverse(),
    bookingsError: bookings.error ? "Could not read the Strategy Call calendar." : null,
  };
}

export async function GET() {
  const access = await requireLeadsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    return NextResponse.json(await load());
  } catch (error) {
    console.error("lead_dms_list_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load leads." }, { status: 500 });
  }
}

/** Refresh: pull the latest DMs from the CRM now instead of waiting for the next 2-minute run. */
export async function POST() {
  const access = await requireLeadsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    await syncLeadDms(createAdminClient());
  } catch (error) {
    console.error("lead_dms_manual_sync_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not reach the CRM. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json(await load());
}
