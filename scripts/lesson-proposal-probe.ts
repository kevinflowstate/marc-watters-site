import { createAdminClient } from "../lib/supabase/admin";
import { proposeCuts } from "../lib/ops/lessons";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("abmmlybdqwzujcysagvf"))
  throw Error("Non-live database required");
const db = createAdminClient();
const { data, error } = await db
  .from("lesson_recordings")
  .insert({
    source: "upload",
    title: "Synthetic Codex proposal check",
    duration_s: 120,
    status: "transcribed",
    transcript_text:
      "[00:00:00] Coach: We are waiting for everyone, check microphones. This is housekeeping until 00:00:15.\n[00:00:15] Coach: Teaching job gross margin: revenue less direct materials and labour costs.\n[00:00:55] Coach: We are pausing for 15 seconds to fix audio.\n[00:01:10] Coach: Teaching resumes, set a weekly job costing review.",
  })
  .select()
  .single();
if (error) throw error;
const l = await proposeCuts(data.id, [
  {
    start_s: 0,
    end_s: 15,
    reason: "housekeeping",
    confidence: 0.99,
    snippet: "Waiting for everyone",
    keep: false,
  },
]);
console.log(
  JSON.stringify({
    pass: true,
    recordingId: l.id,
    status: l.status,
    cuts: l.cut_list,
  }),
);
