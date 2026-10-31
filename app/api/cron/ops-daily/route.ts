import {respond} from "@/lib/ops/http";
import {requireCron} from "@/lib/ops/auth";
import {runDaily} from "@/lib/ops/daily";
export async function GET(request:Request){return respond(async()=>{requireCron(request);return runDaily();});}
