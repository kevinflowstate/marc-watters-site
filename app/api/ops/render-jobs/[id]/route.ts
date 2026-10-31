import {respond} from "@/lib/ops/http";
import {requireOps} from "@/lib/ops/auth";
import {updateRenderJob} from "@/lib/ops/render";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,c:Context){return respond(async()=>{requireOps(request);const {id}=await c.params;return {job:await updateRenderJob(id,await request.json())};});}
