import { requireAdmin } from "@/lib/admin-auth";
import { sendPushToUser } from "@/lib/push";
import { NextResponse } from "next/server";
import { getClientAccess } from "@/lib/client-lifecycle";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId, title, body, url, tag } = await request.json();

  if (!userId || !title) {
    return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
  }
  if (!(await getClientAccess(userId)).active) {
    return NextResponse.json({ error: "Archived clients cannot receive notifications." }, { status: 409 });
  }

  const result = await sendPushToUser(userId, { title, body, url, tag });
  return NextResponse.json(result);
}
