import { getInboxUnreadCount, getInboxViewer } from "@/lib/inbox-server";
import { NextResponse } from "next/server";

export async function GET() {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const unreadCount = await getInboxUnreadCount(viewer);

  return NextResponse.json({ unreadCount });
}
