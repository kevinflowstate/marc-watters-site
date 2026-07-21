import { normalizeAttachments } from "@/lib/attachments";
import { notifyPortalUsers } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("calendar_events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { title, description, folder, event_date, event_time, recurrence, recurrence_day, link, link_label, attachments } = body;

  if (!title?.trim() || !event_date || !event_time) {
    return NextResponse.json({ error: "title, event_date, and event_time are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("calendar_events")
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      folder: folder?.trim() || "General",
      event_date,
      event_time,
      recurrence: recurrence || "none",
      recurrence_day: recurrence_day ?? null,
      link: link?.trim() || null,
      link_label: link_label?.trim() || null,
      attachments: normalizeAttachments(attachments),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyCalendarClients(admin, {
    title: "New calendar event",
    message: `${data.title} has been added to your portal calendar.`,
    tag: `calendar-event-${data.id}`,
  });

  return NextResponse.json({ event: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, notify_clients, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const normalizedUpdates: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.attachments !== undefined) {
    normalizedUpdates.attachments = normalizeAttachments(updates.attachments);
  }
  if (updates.folder !== undefined) {
    normalizedUpdates.folder = typeof updates.folder === "string" && updates.folder.trim() ? updates.folder.trim() : "General";
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("calendar_events")
    .update(normalizedUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (notify_clients) {
    await notifyCalendarClients(admin, {
      title: "Calendar event updated",
      message: `${data.title} has been updated in your portal calendar.`,
      tag: `calendar-event-${data.id}`,
    });
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function notifyCalendarClients(
  admin: ReturnType<typeof createAdminClient>,
  notification: { title: string; message: string; tag: string },
) {
  const { data: clientProfiles } = await admin
    .from("client_profiles")
    .select("user_id")
    .is("archived_at", null);

  const userIds = [...new Set((clientProfiles ?? []).map((profile) => profile.user_id).filter(Boolean))];

  await notifyPortalUsers(
    admin,
    userIds.map((userId) => ({
      userId,
      title: notification.title,
      message: notification.message,
      link: "/portal/calendar",
      pushTag: notification.tag,
    })),
  );
}
