import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { topUpCredits } from "@/lib/ai-usage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (userId) {
    // Return a single user's credits and usage summary
    const { data: profile } = await admin
      .from("client_profiles")
      .select("id, ai_credits, business_name, user:users!client_profiles_user_id_fkey(full_name, email)")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Last 30 days usage
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: usage } = await admin
      .from("ai_usage")
      .select("input_tokens, output_tokens, billed_cost_pence, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    const totalRequests = usage?.length || 0;
    const totalInputTokens = (usage || []).reduce((sum, u) => sum + (u.input_tokens || 0), 0);
    const totalOutputTokens = (usage || []).reduce((sum, u) => sum + (u.output_tokens || 0), 0);
    const totalBilledPence = (usage || []).reduce((sum, u) => sum + Number(u.billed_cost_pence || 0), 0);

    return NextResponse.json({
      profile,
      usage: {
        last30Days: {
          totalRequests,
          totalInputTokens,
          totalOutputTokens,
          totalBilledPence: Math.round(totalBilledPence * 100) / 100,
          totalBilledPounds: Math.round(totalBilledPence) / 100,
        },
        recent: usage?.slice(0, 20) || [],
      },
    });
  }

  // Return all clients with credit balances
  const { data: profiles } = await admin
    .from("client_profiles")
    .select("id, user_id, ai_credits, business_name, user:users!client_profiles_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: true });

  return NextResponse.json({ clients: profiles || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId, amount } = await req.json();
  if (!userId || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "userId and positive amount (in pounds) required" }, { status: 400 });
  }

  const amountPence = Math.round(amount * 100);
  const newBalance = await topUpCredits(userId, amountPence);

  return NextResponse.json({
    success: true,
    newBalancePence: newBalance,
    newBalancePounds: newBalance / 100,
  });
}
