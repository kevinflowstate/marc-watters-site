// Writes drafts. It stores text for an admin to review and may notify admins. It has no path that
// sends a message, email or push to a client (enforced by tests/reply-drafts.test.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { replyDraftsEnabled, voiceUserId } from "./config";
import { callClaude, logAiCall, type ClaudeResult, type FetchLike } from "./anthropic";
import { gatherDraftContext } from "./context";
import { exampleQuery, systemPrompt, userPrompt, type Example } from "./prompts";
import { DRAFT_OUTPUT_SCHEMA, inboxDraftDecision, outcomeFromModel, parseModelDraft } from "./rules";
import { loadThread } from "./store";
import { notifyAdminsOfDraft } from "./notify";
import { staffReactedMessageIds } from "@/lib/inbox-reactions";
import { guardDraft, loadKnownClients, redactText, type KnownClient } from "./privacy";

type DraftRow = {
  id: string;
  kind: "inbox" | "checkin" | "checkin_followup";
  client_id: string;
  conversation_key: string;
  ref_id: string;
  checkin_id: string | null;
  source_message_ids: string[] | null;
  status: string;
};

export type GenerateDeps = { fetchImpl?: FetchLike; now?: Date; push?: boolean };

/** Is the conversation still waiting on Marc? If not, the draft is retired instead of written. */
async function stillNeedsReply(admin: SupabaseClient, draft: DraftRow): Promise<string | null> {
  const { data: profile } = await admin.from("client_profiles").select("archived_at").eq("id", draft.client_id).maybeSingle();
  if (!profile || profile.archived_at) return "client_archived";
  if (draft.kind === "checkin") {
    const { data } = await admin.from("checkins").select("admin_reply").eq("id", draft.checkin_id).maybeSingle();
    if (!data) return "checkin_missing";
    return data.admin_reply ? "admin_replied" : null;
  }
  const thread = await loadThread(admin, draft.client_id);
  const latest = thread[thread.length - 1];
  const reacted = latest ? await staffReactedMessageIds(admin, [latest.id]) : new Set<string>();
  const decision = inboxDraftDecision(thread, reacted, { archived: false });
  return decision.draft ? null : decision.reason;
}

async function loadStyleGuide(admin: SupabaseClient) {
  const { data } = await admin.from("reply_style_guides").select("content, approved_at").eq("id", "marc").maybeSingle();
  return data?.approved_at && data.content ? (data.content as string) : null;
}

/**
 * Marc's past replies to similar messages from other clients. The RPC returns his reply only (never the
 * other client's message); here it is redacted before it can reach a prompt. The unredacted text is kept
 * server-side for the copy guard.
 */
async function loadExamples(admin: SupabaseClient, query: string, clientId: string, clients: KnownClient[]): Promise<{ prompt: Example[]; originals: string[] }> {
  const voice = voiceUserId();
  if (!voice || !query.trim()) return { prompt: [], originals: [] };
  const { data, error } = await admin.rpc("reply_draft_examples", {
    p_query: query,
    p_marc_user_id: voice,
    p_exclude_client_id: clientId,
    p_limit: 8,
  });
  if (error) {
    console.error("reply_drafts_examples_failed", error.message);
    return { prompt: [], originals: [] };
  }
  const rows = ((data || []) as Array<{ source: string; reply_text: string | null }>).filter((e) => e.reply_text);
  return {
    prompt: rows.map((e) => ({ source: e.source, reply_text: redactText(e.reply_text as string, clients) })),
    originals: rows.map((e) => e.reply_text as string),
  };
}

/** Generate one claimed draft. Writes the result only if the draft is still the same pending draft. */
export async function generateDraft(admin: SupabaseClient, draft: DraftRow, deps: GenerateDeps = {}) {
  if (!replyDraftsEnabled()) return { status: "disabled" as const };
  const now = deps.now ?? new Date();

  const answered = await stillNeedsReply(admin, draft);
  if (answered) {
    await admin
      .from("reply_drafts")
      .update({ status: "superseded", decided_at: now.toISOString(), error_message: answered })
      .eq("id", draft.id)
      .eq("status", "pending");
    return { status: "superseded" as const, reason: answered };
  }

  const guide = await loadStyleGuide(admin);
  if (!guide) return { status: "waiting_for_style_guide" as const };

  let result: ClaudeResult | null = null;
  try {
    const ctx = await gatherDraftContext(admin, draft, voiceUserId(), now);
    const clients = await loadKnownClients(admin);
    const examples = await loadExamples(admin, exampleQuery(draft.kind, ctx), draft.client_id, clients);
    const guardExamples = [...examples.originals, ...examples.prompt.map((e) => e.reply_text)];

    let outcome: ReturnType<typeof outcomeFromModel> | null = null;
    let rejection: string | null = null;
    const totals = { input: 0, output: 0, pence: 0 };
    // One retry if the leak guard rejects the first draft.
    for (let attempt = 0; attempt < 2 && !outcome; attempt += 1) {
      result = await callClaude({
        system: systemPrompt(guide),
        user: userPrompt(draft.kind, ctx, examples.prompt, now, rejection ?? undefined),
        maxTokens: 16000,
        effort: "medium",
        jsonSchema: DRAFT_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
        fetchImpl: deps.fetchImpl,
      });
      await logAiCall(admin, { purpose: "draft", draftId: draft.id, result, ok: true });
      totals.input += result.inputTokens;
      totals.output += result.outputTokens;
      totals.pence += result.costPence;
      const candidate =
        result.stopReason === "refusal"
          ? { status: "skipped" as const, draftText: null, reason: "Reply yourself" }
          : outcomeFromModel(parseModelDraft(result.text));
      const shown = [candidate.draftText, candidate.reason].filter(Boolean).join("\n");
      rejection = shown ? guardDraft(shown, { currentClientId: draft.client_id, clients, exampleReplies: guardExamples }) : null;
      if (rejection) {
        console.error("reply_drafts_guard_rejected", { draftId: draft.id, attempt: attempt + 1, reason: rejection });
      } else {
        outcome = candidate;
      }
    }

    if (!outcome) {
      // Both attempts failed the guard: nothing is shown, the reason is kept for Kevin.
      await admin
        .from("reply_drafts")
        .update({
          status: "failed",
          error_message: `guard: ${rejection}`,
          model: result?.model ?? null,
          input_tokens: totals.input,
          output_tokens: totals.output,
          cost_pence: totals.pence,
          claimed_at: null,
          generated_at: new Date().toISOString(),
        })
        .eq("id", draft.id)
        .eq("status", "pending")
        .eq("ref_id", draft.ref_id);
      return { status: "failed" as const, reason: rejection ?? "guard" };
    }
    if (!result) throw new Error("no_model_result");

    const { data: updated } = await admin
      .from("reply_drafts")
      .update({
        status: outcome.status,
        draft_text: outcome.draftText,
        needs_reason: outcome.reason,
        model: result.model,
        input_tokens: totals.input,
        output_tokens: totals.output,
        cost_pence: totals.pence,
        generated_at: new Date().toISOString(),
        claimed_at: null,
        error_message: null,
      })
      .eq("id", draft.id)
      .eq("status", "pending")
      .eq("ref_id", draft.ref_id)
      .select("id");

    if (!updated?.length) return { status: "stale" as const };

    if (deps.push !== false && (outcome.status === "ready" || outcome.status === "needs_marc")) {
      await notifyAdminsOfDraft(admin, { draftId: draft.id, clientId: draft.client_id, status: outcome.status, draftText: outcome.draftText, reason: outcome.reason });
    }
    return { status: outcome.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("reply_drafts_generate_failed", { draftId: draft.id, error: message.slice(0, 300) });
    // Successful calls are already logged; record the failure itself with no tokens.
    await logAiCall(admin, { purpose: "draft", draftId: draft.id, result: null, ok: false });
    await admin
      .from("reply_drafts")
      .update({ status: "failed", error_message: message.slice(0, 500), claimed_at: null })
      .eq("id", draft.id)
      .eq("status", "pending")
      .eq("ref_id", draft.ref_id);
    return { status: "failed" as const };
  }
}

/** Cron entry point: claim drafts whose debounce has passed and write them. */
type ProcessResult = { id: string; status: string; reason?: string };

export async function processDueDrafts(admin: SupabaseClient, limit = 4, deps: GenerateDeps = {}): Promise<{ processed: number; results: ProcessResult[]; reason?: string }> {
  if (!replyDraftsEnabled()) return { processed: 0, results: [], reason: "disabled" };
  if (!(await loadStyleGuide(admin))) return { processed: 0, results: [], reason: "no_style_guide" };
  const { data, error } = await admin.rpc("claim_due_reply_drafts", { p_limit: limit });
  if (error) throw new Error(error.message);
  const results: ProcessResult[] = [];
  for (const row of (data || []) as DraftRow[]) {
    try {
      results.push({ id: row.id, ...(await generateDraft(admin, row, deps)) });
    } catch (error) {
      // Transient read failure before the model call: the claim expires and the next run retries it.
      console.error("reply_drafts_generate_retry", { draftId: row.id, error: error instanceof Error ? error.message : String(error) });
      results.push({ id: row.id, status: "retry" });
    }
  }
  return { processed: results.length, results };
}

/** Lazy path: an admin opened the conversation and its draft is due. Claim it and write it now. */
export async function generateIfDue(admin: SupabaseClient, draftId: string, deps: GenerateDeps = {}) {
  if (!replyDraftsEnabled()) return null;
  const staleBefore = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("reply_drafts")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("status", "pending")
    .lte("due_at", new Date().toISOString())
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .select("id, kind, client_id, conversation_key, ref_id, checkin_id, source_message_ids, status");
  const row = (data || [])[0] as DraftRow | undefined;
  if (!row) return null;
  return generateDraft(admin, row, deps);
}
