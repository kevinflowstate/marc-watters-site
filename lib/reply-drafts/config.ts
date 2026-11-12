import { getEnv } from "@/lib/env";

/** Master switch. Off unless OPS_REPLY_DRAFTS_ENABLED is exactly "true". Nothing is generated or shown when off. */
export function replyDraftsEnabled() {
  return (process.env.OPS_REPLY_DRAFTS_ENABLED || "").trim().toLowerCase() === "true";
}

/** Phase 2 switch for the "Reply to approve" push. Needs the master switch too. */
export function replyDraftPushEnabled() {
  return replyDraftsEnabled() && (process.env.OPS_REPLY_DRAFT_PUSH_ENABLED || "").trim().toLowerCase() === "true";
}

/** The admin whose voice the drafts copy (Marc). Same user the check-in replies are sent as. */
export function voiceUserId(): string | null {
  return getEnv("REPLY_DRAFT_VOICE_USER_ID") || getEnv("FLOWSTATE_PORTAL_REPLY_SENDER_USER_ID") || null;
}

export const REPLY_DRAFT_MODEL = "claude-opus-5-5";

/** Wait this long after the client's last message in a burst before drafting. */
export const INBOX_DEBOUNCE_MS = 2 * 60 * 1000;

/** Endpoint label for logs. Never written to ai_usage, so it can never touch Blueprint AI credits. */
export const REPLY_DRAFT_ENDPOINT = "reply-draft";

/**
 * Anthropic list prices, USD per million tokens.
 * Source: Claude API reference bundled with Claude Code (claude-api skill, model table cached 2026-10-06):
 * Claude Opus 5.5 $4 input / $20 output, cache reads $0.20. Cache writes priced at the standard 1.25x input.
 * Check https://www.anthropic.com/pricing before quoting Marc a price.
 */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

/** USD to GBP pence. Same rate as lib/ai-usage.ts (0.80 GBP per USD) so the two cost logs agree. */
export const USD_TO_PENCE = 80;

export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function costPence(model: string, usage: TokenUsage): { pence: number; inputTokens: number; outputTokens: number; priceKnown: boolean } {
  const known = MODEL_PRICES_USD_PER_MTOK[model];
  const price = known || MODEL_PRICES_USD_PER_MTOK[REPLY_DRAFT_MODEL];
  const input = Number(usage.input_tokens) || 0;
  const cacheWrite = Number(usage.cache_creation_input_tokens) || 0;
  const cacheRead = Number(usage.cache_read_input_tokens) || 0;
  const output = Number(usage.output_tokens) || 0;
  const usd =
    (input * price.input + cacheWrite * price.input * 1.25 + cacheRead * price.input * 0.1 + output * price.output) / 1_000_000;
  return {
    pence: Math.round(usd * USD_TO_PENCE * 10_000) / 10_000,
    inputTokens: input + cacheWrite + cacheRead,
    outputTokens: output,
    priceKnown: Boolean(known),
  };
}
