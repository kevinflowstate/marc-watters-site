import { createAdminClient } from "@/lib/supabase/admin";

// Anthropic pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-haiku-4-5-20251001": { inputPer1M: 0.25, outputPer1M: 1.25 },
  "claude-haiku": { inputPer1M: 0.25, outputPer1M: 1.25 },
  "claude-sonnet-4-5-20251022": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-sonnet": { inputPer1M: 3.0, outputPer1M: 15.0 },
};

const DEFAULT_PRICING = { inputPer1M: 3.0, outputPer1M: 15.0 };
const MARKUP_MULTIPLIER = 2.0;
// Rough USD -> GBP pence conversion: multiply USD by 0.80 then by 100 = * 80
const USD_TO_PENCE = 80;

function getPricing(model: string) {
  // Try exact match first, then partial match
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  const key = Object.keys(MODEL_PRICING).find((k) => model.includes(k) || k.includes(model));
  return key ? MODEL_PRICING[key] : DEFAULT_PRICING;
}

export async function trackAIUsage({
  userId,
  model,
  inputTokens,
  outputTokens,
  endpoint,
}: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  endpoint?: string;
}): Promise<{ actualCost: number; billedCost: number; remainingCredits: number }> {
  const admin = createAdminClient();
  const pricing = getPricing(model);

  // Calculate costs in USD then convert to pence
  const actualCostUsd = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
  const billedCostUsd = actualCostUsd * MARKUP_MULTIPLIER;

  const actualCostPence = Math.ceil(actualCostUsd * USD_TO_PENCE * 100) / 100;
  const billedCostPence = Math.ceil(billedCostUsd * USD_TO_PENCE * 100) / 100;

  // Insert usage record
  await admin.from("ai_usage").insert({
    user_id: userId,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    actual_cost_pence: actualCostPence,
    billed_cost_pence: billedCostPence,
    markup_multiplier: MARKUP_MULTIPLIER,
    endpoint: endpoint || null,
  });

  // Atomic credit deduction using RPC to avoid race conditions
  // Falls back to read-then-write if RPC doesn't exist
  const deductAmount = Math.round(billedCostPence);
  let remainingCredits = 0;

  const { data: rpcResult, error: rpcError } = await admin.rpc("deduct_ai_credits", {
    p_user_id: userId,
    p_amount: deductAmount,
  });

  if (!rpcError && rpcResult !== null) {
    remainingCredits = rpcResult;
  } else {
    // Fallback: read-then-write (non-atomic, acceptable for low concurrency)
    const { data: profile } = await admin
      .from("client_profiles")
      .select("ai_credits")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const newCredits = Math.max(0, (profile.ai_credits || 0) - deductAmount);
      await admin
        .from("client_profiles")
        .update({ ai_credits: newCredits })
        .eq("user_id", userId);
      remainingCredits = newCredits;
    }
  }

  return { actualCost: actualCostPence, billedCost: billedCostPence, remainingCredits };
}

export async function checkAICredits(userId: string): Promise<{ credits: number; hasCredits: boolean }> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("ai_credits")
    .eq("user_id", userId)
    .single();

  const credits = profile?.ai_credits ?? 0;
  return { credits, hasCredits: credits > 0 };
}

export async function topUpCredits(userId: string, amountPence: number): Promise<number> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("ai_credits")
    .eq("user_id", userId)
    .single();

  const currentCredits = profile?.ai_credits ?? 0;
  const newCredits = currentCredits + amountPence;

  await admin
    .from("client_profiles")
    .update({ ai_credits: newCredits })
    .eq("user_id", userId);

  return newCredits;
}
