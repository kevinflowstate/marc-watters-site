import { notifyAdminUsers } from "@/lib/notifications";
import { getEnv } from "@/lib/env";
// External push is deliberately opt-in. Local/non-live verification never contacts people.
export async function notifyOpsAdmins(title:string,message:string,link:string,dedupeKey:string){
 if(getEnv("OPS_NOTIFICATIONS_ENABLED")!=="true")return;
 try{await notifyAdminUsers({title,message,link,dedupeKey});}catch{console.error("Ops notification unavailable");}
}
