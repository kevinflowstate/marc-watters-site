import {respond} from "@/lib/ops/http";
import {requireOps} from "@/lib/ops/auth";
import {updateClientSignals} from "@/lib/ops/onboarding";
export async function POST(request:Request,c:{params:Promise<{id:string}>}){return respond(async()=>{requireOps(request);return {client:await updateClientSignals((await c.params).id,await request.json())};});}
