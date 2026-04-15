import { getInboxUnreadCount, getInboxViewer, listInboxConversations } from "@/lib/inbox-server";
import { NextResponse } from "next/server";

export async function GET() {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [conversations, unreadCount] = await Promise.all([
    listInboxConversations(viewer),
    getInboxUnreadCount(viewer),
  ]);

  return NextResponse.json({
    role: viewer.role,
    clientId: viewer.clientProfileId,
    conversations,
    unreadCount,
  });
}
