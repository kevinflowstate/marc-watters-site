import {respond} from "@/lib/ops/http";
import {requireCron} from "@/lib/ops/auth";
import {createReportDraft} from "@/lib/ops/reports";
export async function GET(request:Request){return respond(async()=>{requireCron(request);return {report:await createReportDraft()};});}
