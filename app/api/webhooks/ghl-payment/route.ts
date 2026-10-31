import {respond} from "@/lib/ops/http";
import {secretMatches} from "@/lib/ops/auth";
import {getEnv} from "@/lib/env";
import {OpsError} from "@/lib/ops/tasks";
import {recordPayment} from "@/lib/ops/payments";
export async function POST(request:Request){return respond(async()=>{if(!secretMatches(request.headers.get("x-webhook-secret"),getEnv("OPS_WEBHOOK_SECRET")))throw new OpsError("Unauthorized",401);return recordPayment(await request.json());});}
