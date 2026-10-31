import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackAIUsage } from "@/lib/ai-usage";
import { OpsError } from "./tasks";
export const OPS_MODEL = "claude-sonnet-5-5";
export async function generateOpsText(
  system: string,
  prompt: string,
  schema?: Record<string, unknown>,
) {
  const key = getEnv("ANTHROPIC_API_KEY");
  if (!key)
    throw new OpsError("NEEDS KEVIN: AI service key is not configured", 503);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPS_MODEL,
      max_tokens: 6000,
      system,
      ...(schema
        ? { output_config: { format: { type: "json_schema", schema } } }
        : {}),
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(55000),
  });
  if (!response.ok)
    throw new OpsError(
      `AI proposal unavailable (${response.status}); no draft changed`,
      502,
    );
  const d = await response.json();
  const db = createAdminClient(),
    admin = await db
      .from("users")
      .select("id")
      .eq("role", "admin")
      .order("created_at")
      .limit(1)
      .single();
  if (admin.data && d.usage)
    await trackAIUsage({
      userId: admin.data.id,
      model: OPS_MODEL,
      inputTokens: d.usage.input_tokens || 0,
      outputTokens: d.usage.output_tokens || 0,
      endpoint: "admin:ops",
    });
  return (d.content || [])
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("\n");
}
