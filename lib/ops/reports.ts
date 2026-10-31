import {createAdminClient} from "@/lib/supabase/admin";
import {OpsError,listTasks} from "./tasks";
export async function listReports(){const r=await createAdminClient().from("ops_reports").select("*").order("week_start",{ascending:false}).limit(100);if(r.error)throw new OpsError(r.error.message,503);return r.data;}
export async function createReportDraft(){const now=new Date();now.setUTCHours(0,0,0,0);now.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));const r=await createAdminClient().from("ops_reports").upsert({week_start:now.toISOString().slice(0,10),status:"draft",data:{tasks:await listTasks()}},{onConflict:"week_start"}).select().single();if(r.error)throw new OpsError(r.error.message,409);return r.data;}
