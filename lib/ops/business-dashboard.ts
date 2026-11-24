import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { LEAD_LOCATION } from "@/lib/lead-dms/config";
import { callsForPeriod } from "./sales-calls";
import { outcomeStats } from "./call-outcomes";
import { paymentsReceived, recurringPayments } from "./report-sources";
import { summariseHubdocWeek } from "./hubdoc-week";

type Range = {from:string;to:string};
const SALES_PIPELINE = "Z3CMicvtro1CL2nQa51X";
async function newLeads(range: Range) {
  const token = getEnv("CBB_GHL_PIT_TOKEN") || getEnv("GHL_LOCATION_TOKEN");
  if(!token) return null;
  const contacts = new Set<string>();
  const query = new URLSearchParams({location_id:LEAD_LOCATION,pipeline_id:SALES_PIPELINE,limit:"100"});
  for(let page=0;page<100;page++) {
    const response=await fetch("https://services.leadconnectorhq.com/opportunities/search?"+query,{
      headers:{Authorization:"Bearer "+token, Version:"2021-07-28"},cache:"no-store",signal:AbortSignal.timeout(7000)
    });
    if(!response.ok) return null;
    const result=await response.json();
    if(!Array.isArray(result.opportunities) || !result.meta) return null;
    for(const o of result.opportunities) {
      const at=Date.parse(o.createdAt);
      if(o.locationId===LEAD_LOCATION && o.pipelineId===SALES_PIPELINE && o.contactId && at>=Date.parse(range.from) && at<Date.parse(range.to)) contacts.add(o.contactId);
    }
    if(!result.meta.nextPage) return contacts.size;
    if(!result.meta.startAfterId || !result.meta.startAfter || query.get("startAfterId")===result.meta.startAfterId) return null;
    query.set("startAfterId",result.meta.startAfterId);
    query.set("startAfter",String(result.meta.startAfter));
  }
  return null;
}

async function publishedPosts(range:Range) {
  const token=getEnv("GHL_LOCATION_TOKEN") || getEnv("CBB_GHL_PIT_TOKEN");
  if(!token) return null;
  const ids=new Set<string>();
  for(let skip=0;skip<10000;skip+=100) {
    const res=await fetch("https://services.leadconnectorhq.com/social-media-posting/"+LEAD_LOCATION+"/posts/list",{
      method:"POST",headers:{Authorization:"Bearer "+token,Version:"2021-07-28","content-type":"application/json"},
      body:JSON.stringify({type:"all",skip:String(skip),limit:"100",includeUsers:"false",fromDate:range.from,toDate:range.to}),
      cache:"no-store",signal:AbortSignal.timeout(7000)
    });
    if(!res.ok) return null;
    const payload=(await res.json()).results;
    if(!Array.isArray(payload?.posts)) return null;
    for(const p of payload.posts) {
      const at=Date.parse(p.publishedAt || p.scheduleDate);
      if(p.deleted!==true && p.status==="published" && at>=Date.parse(range.from) && at<Date.parse(range.to) && (p._id || p.id)) ids.add(p._id || p.id);
    }
    if(payload.posts.length<100 || skip+100>=Number(payload.count)) return ids.size;
  }
  return null;
}

export async function businessDashboard(periods:{current:Range;previous:Range;week_start:string}) {
  const db=createAdminClient();
  const r=periods.current;
  const monthStart = r.to.slice(0,7)+"-01T00:00:00.000Z";
  const [leads, calls, monthly, recurring, posts, receipts] = await Promise.all([
    newLeads(r).catch(()=>null),
    callsForPeriod(Date.parse(r.from),Date.parse(r.to)).then(outcomeStats).catch(()=>null),
    paymentsReceived({current:{from:monthStart,to:r.to},previous:{from:monthStart,to:monthStart}}).catch(()=>null),
    recurringPayments(r).catch(()=>null),publishedPosts(r).catch(()=>null),
    db.from("ops_workspace_results").select("run_key,summary,outcome").eq("kind","payments").gte("run_key","hubdoc:"+periods.previous.from.slice(0,10)).lt("run_key","hubdoc:"+r.to.slice(0,10)+"~")
  ]);
  const priority=await db.from("ops_tasks").select("title").eq("priority",1).in("status",["open","in_progress","awaiting_approval"]).order("due_at",{nullsFirst:false}).order("id").limit(8);
  return { leads,calls,monthly:monthly?.accounts || null,recurring,posts,
    priorities:priority.error ? null : priority.data?.map(t=>t.title) || [],
    receipts:receipts.error ? null : summariseHubdocWeek(receipts.data||[],periods.week_start),
    previousReceipts:receipts.error ? null : summariseHubdocWeek(receipts.data||[],periods.previous.from.slice(0,10))
  };
}
