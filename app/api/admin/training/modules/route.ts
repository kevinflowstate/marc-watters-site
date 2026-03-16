import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

// POST - Create a new training module
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { title, description } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get max order_index
  const { data: last } = await admin
    .from("training_modules")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .single();

  const nextIndex = (last?.order_index ?? -1) + 1;

  const { data: mod, error } = await admin
    .from("training_modules")
    .insert({
      title,
      description: description || "",
      order_index: nextIndex,
      is_published: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ module: mod });
}

// PUT - Update a training module
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, title, description, thumbnail_url, is_published, order_index } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Module ID is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;
  if (is_published !== undefined) updates.is_published = is_published;
  if (order_index !== undefined) updates.order_index = order_index;

  const { data: mod, error } = await admin
    .from("training_modules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ module: mod });
}

// DELETE - Delete a training module
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Module ID is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("training_modules")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
