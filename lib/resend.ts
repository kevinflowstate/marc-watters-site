// Deprecated - use lib/email-templates.ts instead
export { sendCheckinReplyEmail } from "./email-templates";

import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARC_USER_ID } from "@/lib/ops/team-identities";
import { Resend } from "resend";

export async function sendOpsReportEmail(report: {
  id: string; week_start: string; narrative_md: string; observations_md: string; shared_observations_md?: string;
}) {
  if (getEnv("OPS_REPORT_SEND_ENABLED") !== "true") return { sent: false, disabled: true };
  // The "Send to Marc" action contains the private finance narrative.
  const { data, error } = await createAdminClient().auth.admin.getUserById(MARC_USER_ID);
  if (error || !data.user?.email || !data.user.email_confirmed_at) throw new Error("Report recipient unavailable");
  const notes = [report.observations_md, report.shared_observations_md].filter(Boolean).join("\n\n");
  const response = await new Resend(getEnv("RESEND_API_KEY")).emails.send({
    from: "Marc Watters <team@constructionbusinessblueprint.co.uk>",
    to: [data.user.email],
    subject: "CBB weekly report — " + report.week_start,
    text: report.narrative_md + (notes ? "\n\nObservations\n" + notes : ""),
  }, { idempotencyKey: "ops-report:" + report.id });
  if (response.error) throw new Error("Report email unavailable");
  return { sent: true, disabled: false };
}
