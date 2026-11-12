// One Messages API call for reply drafts and the style guide. Raw fetch, matching the existing
// Blueprint AI and growth report routes (the project does not install the Anthropic SDK).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { REPLY_DRAFT_MODEL, costPence, type TokenUsage } from "./config";

export type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

export type ClaudeResult = {
  text: string;
  model: string;
  usage: TokenUsage;
  costPence: number;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
};

export async function callClaude(opts: {
  system: string;
  user: string;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  jsonSchema?: Record<string, unknown>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<ClaudeResult> {
  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("anthropic_not_configured");
  const doFetch: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));

  const outputConfig: Record<string, unknown> = { effort: opts.effort };
  if (opts.jsonSchema) outputConfig.format = { type: "json_schema", schema: opts.jsonSchema };

  const response = await doFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Server-side refusal fallback, recommended for Opus 5.5 (routes a policy decline to a fallback model).
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: REPLY_DRAFT_MODEL,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: outputConfig,
      fallbacks: "default",
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`anthropic_${response.status}:${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    model?: string;
    stop_reason?: string | null;
    content?: Array<{ type: string; text?: string }>;
    usage?: TokenUsage;
  };
  const model = data.model || REPLY_DRAFT_MODEL;
  const usage = data.usage || {};
  const cost = costPence(model, usage);
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
  return {
    text,
    model,
    usage,
    costPence: cost.pence,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    stopReason: data.stop_reason ?? null,
  };
}

/** Cost log. Service-role table only; never ai_usage, so Blueprint AI credits are never touched. */
export async function logAiCall(
  admin: SupabaseClient,
  row: { purpose: "draft" | "style_guide"; draftId?: string | null; result?: ClaudeResult | null; ok: boolean },
) {
  const { error } = await admin.from("reply_draft_ai_calls").insert({
    purpose: row.purpose,
    draft_id: row.draftId ?? null,
    model: row.result?.model || REPLY_DRAFT_MODEL,
    input_tokens: row.result?.inputTokens ?? 0,
    output_tokens: row.result?.outputTokens ?? 0,
    cost_pence: row.result?.costPence ?? 0,
    ok: row.ok,
  });
  if (error) console.error("reply_drafts_cost_log_failed", error.message);
}
