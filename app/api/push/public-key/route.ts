import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export async function GET() {
  const publicKey = getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || getEnv("VAPID_PUBLIC_KEY") || null;

  return NextResponse.json(
    { publicKey },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
