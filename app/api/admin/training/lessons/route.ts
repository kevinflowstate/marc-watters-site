import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAttachments } from "@/lib/attachments";
import { requireAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

// POST - Create a new lesson within a module
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { module_id, title, content_type, content_url, content_text, duration_minutes, attachments } = await req.json();

  if (!module_id || !title) {
    return NextResponse.json({ error: "module_id and title are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get max order_index for this module
  const { data: last } = await admin
    .from("module_content")
    .select("order_index")
    .eq("module_id", module_id)
    .order("order_index", { ascending: false })
    .limit(1)
    .single();

  const nextIndex = (last?.order_index ?? -1) + 1;

  const { data: lesson, error } = await admin
    .from("module_content")
    .insert({
      module_id,
      title,
      content_type: content_type ?? "video",
      content_url: content_url ?? null,
      content_text: content_text ?? null,
      duration_minutes: duration_minutes ?? null,
      attachments: normalizeAttachments(attachments),
      order_index: nextIndex,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lesson });
}

// PUT - Update a lesson
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, title, content_type, content_url, content_text, duration_minutes, order_index, attachments } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content_type !== undefined) updates.content_type = content_type;
  if (content_url !== undefined) updates.content_url = content_url;
  if (content_text !== undefined) updates.content_text = content_text;
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
  if (attachments !== undefined) updates.attachments = normalizeAttachments(attachments);
  if (order_index !== undefined) updates.order_index = order_index;

  const { data: lesson, error } = await admin
    .from("module_content")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lesson });
}

// DELETE - Delete a lesson
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("module_content")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
