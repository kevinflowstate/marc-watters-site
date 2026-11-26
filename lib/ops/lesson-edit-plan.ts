import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateLessonPackage } from "./lesson-review";
import { loadLessonSource } from "./lesson-source";
import { OpsError } from "./tasks";

const seconds = z.number().finite().min(0).max(8 * 3600);
const schema = z.object({
  kind: z.literal("lesson_edit"),
  lesson_date: z.iso.date(),
  recording_id: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  summary_md: z.string().startsWith("**Here's what you learned**").max(5000),
  review_note: z.string().max(2000),
  transcript_end_s: seconds.positive(),
  keep_ranges: z.array(z.tuple([seconds, seconds.nullable()])).min(1).max(100),
  workbook: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type EditPlan = z.infer<typeof schema>;

export function lessonPack(plan: EditPlan, storage_path: string, sha256: string) {
  return { schema_version: 1, lesson_ref: `lesson:${plan.lesson_date}:recording-${plan.recording_id}`,
    version: 1, mode: "append", module_id: "faa36657-fa83-4f66-87cb-cf597b3d75b2",
    title: plan.title, summary_md: plan.summary_md, workbook_md: "", ...(plan.workbook ? { workbook: plan.workbook } : {}),
    media: { storage_path, sha256 } };
}

export function parseLessonEdit(doc: unknown, filename: string) {
  const parsed = schema.safeParse(doc);
  if (!parsed.success) throw new OpsError("Lesson edit document has invalid fields");
  const plan = parsed.data;
  if (filename !== `CBB lesson edit ${plan.lesson_date}`) throw new OpsError("Lesson date differs from the document title");
  let previous = 0;
  for (const [start, end] of plan.keep_ranges) {
    if (start < previous || (end !== null && end <= start)) throw new OpsError("Lesson keep ranges overlap or are reversed");
    previous = end ?? Infinity;
  }
  const sha = "0".repeat(64);
  validateLessonPackage(lessonPack(plan, `approved/${sha}.mp4`, sha));
  return plan;
}

export async function queueLessonEdit(doc: unknown, filename: string) {
  const plan = parseLessonEdit(doc, filename);
  const src = await loadLessonSource(plan.lesson_date);
  if (!src || src.recording_id !== plan.recording_id) throw new OpsError("Edit plan does not match the portal recording", 409);
  if (src.status === "packaged") {
    // A service operator can arm one verification-only rehearsal of an existing review.
    // Normal duplicates never start another machine or open a second review.
    const rehearsal = await createAdminClient().from("ops_lesson_edit_jobs").update({ plan, state: "queued" })
      .eq("lesson_date", plan.lesson_date).eq("recording_id", plan.recording_id)
      .eq("verify_only", true).eq("state", "awaiting_plan").select("lesson_date").maybeSingle();
    if (rehearsal.error) throw new OpsError("Could not check the existing lesson handoff", 503);
    return rehearsal.data ? "rehearsal_queued" : "already_packaged";
  }
  if (src.status !== "ready") throw new OpsError("Recording is still preparing", 409);
  const db = createAdminClient();
  const result = await db.from("ops_lesson_edit_jobs").upsert({ lesson_date: plan.lesson_date,
    recording_id: plan.recording_id, plan }, { onConflict: "lesson_date", ignoreDuplicates: true });
  if (result.error) throw new OpsError("Could not queue the text edit plan", 503);
  // A new edit to a previously accepted plan needs explicit reconciliation, never silent substitution.
  const stored = await db.from("ops_lesson_edit_jobs").select("plan").eq("lesson_date", plan.lesson_date).single();
  if (stored.error) throw new OpsError("Could not check the queued edit plan", 503);
  if (!isDeepStrictEqual(stored.data.plan, plan)) throw new OpsError("A different edit plan already exists for this call", 409);
  return "queued";
}
