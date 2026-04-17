import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;

  return NextResponse.json(
    { publicKey },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
