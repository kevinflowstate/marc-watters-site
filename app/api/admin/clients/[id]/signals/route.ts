import {respond,adminActor} from "@/lib/ops/http";
import {getClient} from "@/lib/ops/clients";
import {updateClientSignals} from "@/lib/ops/onboarding";
type C={params:Promise<{id:string}>};
export async function GET(_r:Request,c:C){return respond(async()=>{await adminActor();return {client:await getClient((await c.params).id)};});}
export async function PATCH(r:Request,c:C){return respond(async()=>{const actor=await adminActor();return {client:await updateClientSignals((await c.params).id,await r.json(),actor)};});}
