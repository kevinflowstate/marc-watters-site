import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export function requireFlowstateAccess(request: Request) {
  const expected = process.env.FLOWSTATE_PORTAL_API_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "flowstate_portal_access_not_configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";

  if (!safeEqual(supplied, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return null;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
