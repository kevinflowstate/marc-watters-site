import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Messages a member of staff has reacted to (thumbs up, heart...). Marc, 12 Nov 2026: a reaction on the
 * client's latest message means it has been seen and answered, so it no longer needs a reply.
 * A failed read returns nothing, which leaves those conversations showing as needing a reply.
 */
export async function staffReactedMessageIds(admin: SupabaseClient, messageIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(messageIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await admin
      .from("inbox_message_reactions")
      .select("message_id,user:users!inner(role)")
      .in("message_id", ids.slice(i, i + 100))
      .eq("user.role", "admin");
    if (error) continue;
    for (const r of (data || []) as Array<{ message_id: string }>) out.add(r.message_id);
  }
  return out;
}
