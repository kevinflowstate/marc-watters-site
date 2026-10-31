// Deprecated - use lib/email-templates.ts instead
export { sendCheckinReplyEmail } from "./email-templates";

import {getEnv} from "@/lib/env";
import {createAdminClient} from "@/lib/supabase/admin";
import {Resend} from "resend";
export async function sendOpsReportEmail(report:{id:string;week_start:string;narrative_md:string;observations_md:string}){
 if(getEnv("OPS_REPORT_SEND_ENABLED")!=="true"){console.info("Ops report send disabled",{report_id:report.id});return {sent:false,disabled:true};}
 const r=await createAdminClient().from("users").select("email").eq("role","admin");if(r.error||!r.data?.length)throw new Error("Report recipients unavailable");
 const response=await new Resend(getEnv("RESEND_API_KEY")).emails.send({from:"Marc Watters <team@constructionbusinessblueprint.co.uk>",to:[...new Set(r.data.map(u=>u.email))],subject:`CBB weekly report — ${report.week_start}`,text:report.narrative_md+(report.observations_md?"\n\nObservations\n"+report.observations_md:"")},{idempotencyKey:`ops-report:${report.id}`});if(response.error)throw new Error("Report email unavailable");return {sent:true,disabled:false};
}
