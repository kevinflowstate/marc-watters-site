import { getInboxThread, getInboxViewer } from "@/lib/inbox-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id") || undefined;

  const thread = await getInboxThread(viewer, clientId);

  if (!thread) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json(thread);
}
